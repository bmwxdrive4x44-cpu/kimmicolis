import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';
export const preferredRegion = ['cdg1', 'fra1'];

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
