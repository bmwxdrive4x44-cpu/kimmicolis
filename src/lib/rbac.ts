import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getToken } from 'next-auth/jwt';
import { normalizeRole } from './roles';

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'secret');

export interface JWTPayload {
  email: string;
  id: string;
  role: string;
  name: string;
  [key: string]: any;
}

/**
 * Extracts and verifies JWT from headers
 * @param request NextRequest
 * @returns { payload: JWTPayload, error?: string }
 */
export async function verifyJWT(request: NextRequest): Promise<{
  payload?: JWTPayload;
  error?: string;
}> {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const verified = await jwtVerify(token, JWT_SECRET);
      return { payload: verified.payload as JWTPayload };
    }

    const nextAuthToken = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!nextAuthToken) {
      return { error: 'Missing token' };
    }

    return {
      payload: {
        email: String(nextAuthToken.email ?? ''),
        id: String(nextAuthToken.sub ?? nextAuthToken.id ?? ''),
        role: normalizeRole(nextAuthToken.role),
        name: String(nextAuthToken.name ?? ''),
      },
    };
  } catch (err) {
    return { error: 'Invalid token' };
  }
}

/**
 * Middleware to check role-based access
 * @param allowedRoles Array of allowed roles (e.g., ['ADMIN', 'RELAIS'])
 * @returns Function that validates request or returns error response
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ success: true; payload: JWTPayload } | { success: false; response: NextResponse }> {
  const { payload, error } = await verifyJWT(request);

  if (error || !payload) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role));
  if (!normalizedAllowedRoles.includes(normalizeRole(payload.role))) {
    return {
      success: false,
      response: NextResponse.json({
        error: `Forbidden: requires one of roles [${allowedRoles.join(', ')}]`,
      }, { status: 403 }),
    };
  }

  return { success: true, payload };
}

/**
 * Check if user matches ID or has required role
 * @param payload JWT payload
 * @param userId User ID to check
 * @param adminRoles Admin roles that can bypass ownership check
 */
export function hasAccess(
  payload: JWTPayload,
  userId: string,
  adminRoles: string[] = ['ADMIN']
): boolean {
  return payload.id === userId || adminRoles.includes(payload.role);
}
