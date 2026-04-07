import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { normalizeRole } from '@/lib/roles';

function isMissingClientTypeColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.toLowerCase().includes('clienttype');
}

// GET all users (ADMIN ONLY)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    try {
      const users = await db.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          address: true,
          role: true,
          phone: true,
          siret: true,
          isActive: true,
          clientType: true,
          createdAt: true,
          relais: {
            select: {
              id: true,
              commerceName: true,
              status: true,
              operationalStatus: true,
              address: true,
              ville: true,
            },
          },
          enseigne: {
            select: {
              id: true,
              businessName: true,
              operationalCity: true,
              billingEmail: true,
            },
          },
          transporterApplication: {
            select: {
              id: true,
              vehicle: true,
              regions: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(users);
    } catch (error) {
      // If clientType doesn't exist, retry without it
      if (isMissingClientTypeColumnError(error)) {
        try {
          const users = await db.user.findMany({
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              address: true,
              role: true,
              phone: true,
              siret: true,
              isActive: true,
              createdAt: true,
              relais: {
                select: {
                  id: true,
                  commerceName: true,
                  status: true,
                  operationalStatus: true,
                  address: true,
                  ville: true,
                },
              },
              enseigne: {
                select: {
                  id: true,
                  businessName: true,
                  operationalCity: true,
                  billingEmail: true,
                },
              },
              transporterApplication: {
                select: {
                  id: true,
                  vehicle: true,
                  regions: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          });

          return NextResponse.json(users.map((user) => ({ ...user, clientType: 'STANDARD' })));
        } catch (fallbackError) {
          console.error('Fallback query failed:', fallbackError);
          // Last resort: query without relais
          const users = await db.user.findMany({
            orderBy: { createdAt: 'desc' },
          });
          return NextResponse.json(
            users.map((user) => ({
              ...user,
              clientType: 'STANDARD',
              relais: null,
              enseigne: null,
              transporterApplication: null,
            }))
          );
        }
      } else {
        // For any other error, try simple query without relations
        console.warn('Query with relais failed, retrying without relations:', error);
        const users = await db.user.findMany({
          orderBy: { createdAt: 'desc' },
        });
        return NextResponse.json(
          users.map((user) => ({
            ...user,
            clientType: 'STANDARD',
            relais: null,
            enseigne: null,
            transporterApplication: null,
          }))
        );
      }
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST create user
export async function POST(request: NextRequest) {
  const rateCheck = await checkRateLimit(request, RATE_LIMIT_PRESETS.moderate);
  if (rateCheck.limited) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', retryAfter: rateCheck.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
    );
  }

  try {
    const body = await request.json();
    const { name, firstName, lastName, address, email, password, phone, role, siret } = body;
    const normalizedRole = normalizeRole(role);

    const normalizedFirstName = String(firstName || '').trim();
    const normalizedLastName = String(lastName || '').trim();
    const normalizedAddress = String(address || '').trim();
    const fullName = String(name || `${normalizedFirstName} ${normalizedLastName}`.trim()).trim();

    // Validate required fields
    if (!fullName || !email || !password) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'Name, email and password are required' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ 
        error: 'Password too short',
        details: 'Password must be at least 6 characters' 
      }, { status: 400 });
    }

    const normalizedSiret = normalizeCommerceRegisterNumber(String(siret || ''));

    if ((normalizedRole === 'TRANSPORTER' || normalizedRole === 'RELAIS') && !normalizedSiret) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'Le numéro du registre du commerce est obligatoire pour les transporteurs et les points relais',
      }, { status: 400 });
    }

    if ((normalizedRole === 'TRANSPORTER' || normalizedRole === 'RELAIS') && !isAlgerianCommerceRegisterNumber(normalizedSiret)) {
      return NextResponse.json({
        error: 'Invalid commerce register number format',
        details: 'Format RC algérien invalide (ex: RC-16/1234567B21)',
      }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json({ 
        error: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS',
        details: 'An account with this email already exists' 
      }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await db.user.create({
      data: {
        name: fullName,
        firstName: normalizedFirstName || null,
        lastName: normalizedLastName || null,
        address: normalizedAddress || null,
        email: email.toLowerCase(),
        password: hashedPassword,
        phone: phone || null,
        role: normalizedRole,
        siret: (normalizedRole === 'TRANSPORTER' || normalizedRole === 'RELAIS') ? normalizedSiret : null,
      },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      role: user.role,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ 
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
