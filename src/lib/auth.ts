import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { env } from './env';
import { normalizeRole } from './roles';
import { banRelayIdentities, describeBlockedIdentity, findBlockedRelayIdentity } from './banned-identities';
import { getClientIpFromHeaders } from './request-ip';

const BCRYPT_ROUNDS = 12;

type MaybeClientType = {
  clientType?: string | null;
};

function readClientType(value: unknown) {
  const clientType = (value as MaybeClientType | null | undefined)?.clientType;
  return typeof clientType === 'string' && clientType.length > 0 ? clientType : 'STANDARD';
}

function isDevDemoAuthEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_DEMO_AUTH === 'true';
}

type DemoAccountConfig = {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'CLIENT' | 'TRANSPORTER' | 'RELAIS' | 'ENSEIGNE';
  phone: string;
  siret?: string;
  relais?: {
    commerceName: string;
    address: string;
    ville: string;
    status: string;
    commissionPetit: number;
    commissionMoyen: number;
    commissionGros: number;
  };
};

const DEMO_ACCOUNTS: DemoAccountConfig[] = [
  {
    email: 'admin@swiftcolis.dz',
    password: 'admin123',
    name: 'Admin SwiftColis',
    role: 'ADMIN',
    phone: '+213555000000',
  },
  {
    email: 'client@demo.dz',
    password: 'client123',
    name: 'Ahmed Benali',
    role: 'CLIENT',
    phone: '+213555111111',
  },
  {
    email: 'transport@demo.dz',
    password: 'transport123',
    name: 'Karim Transport',
    role: 'TRANSPORTER',
    phone: '+213555222222',
    siret: '12345678901234',
  },
  {
    email: 'relais@demo.dz',
    password: 'relais123',
    name: 'Relais Centre',
    role: 'RELAIS',
    phone: '+213555333333',
    relais: {
      commerceName: 'Epicerie du Centre',
      address: '123 Rue Didouche Mourad',
      ville: 'alger',
      status: 'APPROVED',
      commissionPetit: 100,
      commissionMoyen: 200,
      commissionGros: 300,
    },
  },
  {
    email: 'enseigne@demo.dz',
    password: 'enseigne123',
    name: 'Boutique Atlas',
    role: 'ENSEIGNE',
    phone: '+213555444444',
    siret: 'RC-16/1234567B21',
  },
];

function isBcryptHash(hashedPassword: string): boolean {
  return hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2y$');
}

function isUnknownClientTypeFieldError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('Unknown field `clientType`') && message.includes('model `User`');
}

function isMissingClientTypeColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const maybeCode = (error as { code?: string } | null)?.code;

  if (maybeCode === 'P2022' && message.toLowerCase().includes('clienttype')) {
    return true;
  }

  return (
    message.includes('User.clientType') &&
    (message.includes('does not exist') || message.includes('n\'existe pas'))
  );
}

async function findUserForAuth(email: string) {
  const normalizedEmail = email.toLowerCase();

  try {
    return await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phone: true,
        siret: true,
        password: true,
        clientType: true,
        relais: {
          select: {
            id: true,
            status: true,
            operationalStatus: true,
          },
        },
      },
    });
  } catch (error) {
    if (!isUnknownClientTypeFieldError(error) && !isMissingClientTypeColumnError(error)) {
      throw error;
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        phone: true,
        siret: true,
        password: true,
        relais: {
          select: {
            id: true,
            status: true,
            operationalStatus: true,
          },
        },
      },
    });

    return user ? { ...user, clientType: 'STANDARD' } : null;
  }
}

async function hashLegacyPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function ensureDevelopmentDemoUser(email: string, password: string) {
  // Désactive la création de comptes démo en production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const demoAccount = DEMO_ACCOUNTS.find(
    (account) => account.email === email.toLowerCase() && account.password === password
  );
  if (!demoAccount) {
    return null;
  }

  const hashedPassword = await hashPassword(demoAccount.password);
  const user = await db.user.upsert({
    where: { email: demoAccount.email },
    update: {
      password: hashedPassword,
      name: demoAccount.name,
      role: demoAccount.role,
      phone: demoAccount.phone,
      siret: demoAccount.siret,
      isActive: true,
    },
    create: {
      email: demoAccount.email,
      password: hashedPassword,
      name: demoAccount.name,
      role: demoAccount.role,
      phone: demoAccount.phone,
      siret: demoAccount.siret,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      phone: true,
      siret: true,
      password: true,
      clientType: true,
      relais: {
        select: {
          id: true,
          status: true,
          operationalStatus: true,
        },
      },
    },
  });

  if (demoAccount.role === 'RELAIS' && demoAccount.relais) {
    await db.relais.upsert({
      where: { userId: user.id },
      update: {
        commerceName: demoAccount.relais.commerceName,
        address: demoAccount.relais.address,
        ville: demoAccount.relais.ville,
        status: demoAccount.relais.status,
        commissionPetit: demoAccount.relais.commissionPetit,
        commissionMoyen: demoAccount.relais.commissionMoyen,
        commissionGros: demoAccount.relais.commissionGros,
      },
      create: {
        userId: user.id,
        commerceName: demoAccount.relais.commerceName,
        address: demoAccount.relais.address,
        ville: demoAccount.relais.ville,
        status: demoAccount.relais.status,
        commissionPetit: demoAccount.relais.commissionPetit,
        commissionMoyen: demoAccount.relais.commissionMoyen,
        commissionGros: demoAccount.relais.commissionGros,
      },
    });
  }

  return user;
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  if (isBcryptHash(hashedPassword)) {
    return bcrypt.compare(password, hashedPassword);
  }

  const legacyHash = await hashLegacyPassword(password);
  return legacyHash === hashedPassword;
}

export function passwordNeedsRehash(hashedPassword: string): boolean {
  return !isBcryptHash(hashedPassword);
}

async function safeCreateActionLog(data: {
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  details?: string;
  ipAddress?: string;
}) {
  try {
    await db.actionLog.create({ data });
  } catch (error) {
    // Logging must never block authentication flow.
    console.warn('[auth] action log write skipped:', error);
  }
}

// Configuration NextAuth
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const normalizedEmail = credentials.email.toLowerCase().trim();
          const clientIp = getClientIpFromHeaders((req as { headers?: Headers | Record<string, string | string[] | undefined> } | undefined)?.headers);

          const blockedIdentity = await findBlockedRelayIdentity({
            email: normalizedEmail,
            ip: clientIp,
          });

          if (blockedIdentity) {
            await safeCreateActionLog({
              entityType: 'USER',
              entityId: blockedIdentity.sourceUserId || normalizedEmail,
              action: 'LOGIN_BLOCKED_BANNED_IDENTITY',
              details: JSON.stringify({
                email: normalizedEmail,
                ipAddress: clientIp,
                blockedType: blockedIdentity.type,
                reason: describeBlockedIdentity(blockedIdentity),
              }),
              ipAddress: clientIp || undefined,
            });

            throw new Error(`BANNED_IDENTITY:${blockedIdentity.type}`);
          }

          // Optional local helper: demo account auto-provisioning is disabled by default.
          if (isDevDemoAuthEnabled()) {
            await ensureDevelopmentDemoUser(normalizedEmail, credentials.password);
          }

          let user = await findUserForAuth(normalizedEmail);

          if (!user && isDevDemoAuthEnabled()) {
            console.warn('[auth] user not found, force demo user creation', normalizedEmail);
            user = await ensureDevelopmentDemoUser(normalizedEmail, credentials.password);
          }

          if (!user || !user.password) {
            console.warn('[auth] user is missing or has no password', normalizedEmail, user);
            return null;
          }

          if (!user.isActive) {
            throw new Error('EMAIL_NOT_VERIFIED');
          }

          let isValid = await verifyPassword(credentials.password, user.password);
          console.log('[auth] verifyPassword', normalizedEmail, isValid);

          if (!isValid && isDevDemoAuthEnabled()) {
            // Re-hash / upsert possible stale demo user password and retry.
            console.log('[auth] retry demo user sync for', normalizedEmail);
            await ensureDevelopmentDemoUser(normalizedEmail, credentials.password);
            const reloaded = await db.user.findUnique({
              where: { email: normalizedEmail },
            });
            if (reloaded?.password) {
              isValid = await verifyPassword(credentials.password, reloaded.password);
              console.log('[auth] verifyPassword retry', normalizedEmail, isValid);
            }
          }

          if (!isValid) {
            console.warn('[auth] invalid credentials', normalizedEmail);
            return null;
          }

          if (normalizeRole(user.role) === 'RELAIS' && user.relais?.operationalStatus === 'SUSPENDU') {
            await banRelayIdentities({
              email: user.email,
              siret: user.siret,
              ip: clientIp,
              sourceRelaisId: user.relais.id,
              sourceUserId: user.id,
              reason: 'Relais suspendu - bannissement appliqué lors de la tentative de connexion',
            });

            await safeCreateActionLog({
              userId: user.id,
              entityType: 'RELAIS',
              entityId: user.relais.id,
              action: 'LOGIN_BLOCKED_SUSPENDED_RELAY',
              details: JSON.stringify({ email: user.email, ipAddress: clientIp }),
              ipAddress: clientIp || undefined,
            });

            throw new Error('BANNED_IDENTITY:EMAIL');
          }

          if (passwordNeedsRehash(user.password)) {
            const upgradedPassword = await hashPassword(credentials.password);
            await db.user.update({
              where: { id: user.id },
              data: { password: upgradedPassword },
            });
          }

          await safeCreateActionLog({
            userId: user.id,
            entityType: 'USER',
            entityId: user.id,
            action: 'LOGIN_SUCCESS',
            details: JSON.stringify({ role: normalizeRole(user.role), email: user.email }),
            ipAddress: clientIp || undefined,
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: normalizeRole(user.role),
            phone: user.phone ?? undefined,
            relaisId: user.relais?.id ?? null,
            relaisStatus: user.relais?.status ?? undefined,
            clientType: readClientType(user),
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error || '');
          if (message.startsWith('BANNED_IDENTITY:') || message === 'EMAIL_NOT_VERIFIED') {
            throw error;
          }

          // Prevent leaking raw Prisma/DB internals to the login page.
          console.error('[auth] authorize failed:', error);
          throw new Error('SERVICE_UNAVAILABLE');
        }
      },
    }),
  ],
  secret: env.NEXTAUTH_SECRET,
  debug: env.NODE_ENV === 'development',
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = normalizeRole(user.role);
        token.phone = user.phone;
        token.relaisId = user.relaisId;
        token.relaisStatus = user.relaisStatus;
        token.clientType = readClientType(user);
      } else if (token.role) {
        token.role = normalizeRole(token.role);
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = normalizeRole(token.role);
        session.user.phone = token.phone as string;
        session.user.relaisId = token.relaisId as string;
        session.user.relaisStatus = token.relaisStatus as string;
        session.user.clientType = (token.clientType as string) ?? 'STANDARD';
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/login',
  },
};

// Déclarations de types pour NextAuth
declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    phone?: string;
    relaisId?: string | null;
    relaisStatus?: string;
  }
  interface Session {
    user: User & {
      id: string;
      email: string;
      name: string;
      role: string;
      phone?: string;
      relaisId?: string | null;
      relaisStatus?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    relaisId?: string | null;
    relaisStatus?: string;
  }
}

