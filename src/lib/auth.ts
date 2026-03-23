import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';

const BCRYPT_ROUNDS = 12;

function isBcryptHash(hashedPassword: string): boolean {
  return hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2y$');
}

async function hashLegacyPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
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

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
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

        if (!user || !user.password) {
          return null;
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
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
          role: user.role,
          phone: user.phone ?? undefined,
          relaisId: user.relais?.id ?? null,
          relaisStatus: user.relais?.status ?? undefined,
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
        token.role = user.role;
        token.phone = user.phone;
        token.relaisId = user.relaisId;
        token.relaisStatus = user.relaisStatus;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
        session.user.phone = token.phone as string;
        session.user.relaisId = token.relaisId as string;
        session.user.relaisStatus = token.relaisStatus as string;
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

export { hashPassword };
