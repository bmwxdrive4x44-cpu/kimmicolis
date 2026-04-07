import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { normalizeRole } from './roles';

const BCRYPT_ROUNDS = 12;

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
        phone: true,
        password: true,
        clientType: true,
        relais: {
          select: {
            id: true,
            status: true,
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
        phone: true,
        password: true,
        relais: {
          select: {
            id: true,
            status: true,
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
      phone: true,
      password: true,
      clientType: true,
      relais: {
        select: {
          id: true,
          status: true,
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

// Configuration NextAuth
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Ensure demo users are created / updated in dev for every login attempt.
        if (process.env.NODE_ENV !== 'production') {
          await ensureDevelopmentDemoUser(credentials.email, credentials.password);
        }

        let user = await findUserForAuth(credentials.email);

        if (!user) {
          console.warn('[auth] user not found, force demo user creation', credentials.email);
          user = await ensureDevelopmentDemoUser(credentials.email, credentials.password);
        }

        if (!user || !user.password) {
          console.warn('[auth] user is missing or has no password', credentials.email, user);
          return null;
        }

        let isValid = await verifyPassword(credentials.password, user.password);
        console.log('[auth] verifyPassword', credentials.email, isValid);

        if (!isValid && process.env.NODE_ENV !== 'production') {
          // Re-hash / upsert possible stale demo user password and retry.
          console.log('[auth] retry demo user sync for', credentials.email);
          await ensureDevelopmentDemoUser(credentials.email, credentials.password);
          const reloaded = await db.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
          });
          if (reloaded?.password) {
            isValid = await verifyPassword(credentials.password, reloaded.password);
            console.log('[auth] verifyPassword retry', credentials.email, isValid);
          }
        }

        if (!isValid) {
          console.warn('[auth] invalid credentials', credentials.email);
          return null;
        }

        if (passwordNeedsRehash(user.password)) {
          const upgradedPassword = await hashPassword(credentials.password);
          await db.user.update({
            where: { id: user.id },
            data: { password: upgradedPassword },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
          phone: user.phone ?? undefined,
          relaisId: user.relais?.id ?? null,
          relaisStatus: user.relais?.status ?? undefined,
          clientType: (user as any).clientType ?? 'STANDARD',
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
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
        token.clientType = (user as any).clientType ?? 'STANDARD';
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

