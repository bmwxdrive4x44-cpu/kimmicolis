import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from './db';

// Simple password hashing
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === hashedPassword;
}

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
          include: { relais: true },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          relaisId: user.relais?.id || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
        token.relaisId = user.relaisId;
      }
      
      // Update session - fetch fresh user data from database
      if (trigger === 'update' && token.id) {
        try {
          const freshUser = await db.user.findUnique({
            where: { id: token.id as string },
            include: { relais: true },
          });
          if (freshUser) {
            token.id = freshUser.id;
            token.email = freshUser.email;
            token.name = freshUser.name;
            token.role = freshUser.role;
            token.relaisId = freshUser.relais?.id || null;
          }
        } catch (error) {
          console.error('Error refreshing user data:', error);
        }
        if (session) {
          token = { ...token, ...session };
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
        session.user.relaisId = token.relaisId as string | null;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Handle relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      // Handle same-origin URLs
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      // Default to baseUrl
      return baseUrl;
    },
  },
  events: {
    async signOut() {
      // Clear any additional session data if needed
    },
  },
  pages: {
    signIn: '/auth/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || 'swiftcolis-secret-key-2024',
  debug: process.env.NODE_ENV === 'development',
  useSecureCookies: process.env.NODE_ENV === 'production',
};

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    relaisId?: string | null;
  }
  interface Session {
    user: User & {
      id: string;
      email: string;
      name: string;
      role: string;
      relaisId: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    email: string;
    name: string;
    role: string;
    relaisId?: string | null;
  }
}

export { hashPassword };
