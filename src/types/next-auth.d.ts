import NextAuth, { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      clientType: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: string;
    clientType: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
    clientType: string;
  }
}
