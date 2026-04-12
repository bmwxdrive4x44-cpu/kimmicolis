import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { isAlgerianCommerceRegisterNumber, normalizeCommerceRegisterNumber } from '@/lib/validators';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/ratelimit';
import { normalizeRole } from '@/lib/roles';
import { describeBlockedIdentity, findBlockedRelayIdentity } from '@/lib/banned-identities';
import { getClientIpFromHeaders } from '@/lib/request-ip';
import { sendRegistrationConfirmationEmail } from '@/lib/email';
import { createEmailVerificationToken } from '@/lib/email-verification';

function isMissingClientTypeColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.toLowerCase().includes('clienttype');
}

function isValidPersonName(value: string): boolean {
  return /^[A-Za-zÀ-ÿ'\-\s]{2,60}$/.test(value);
}

function isValidPhone(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value);
}

async function fetchUsersWithMinimalSelect() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map((user) => ({
    ...user,
    firstName: null,
    lastName: null,
    address: null,
    phone: null,
    siret: null,
    isActive: true,
    clientType: 'STANDARD',
    relais: null,
    enseigne: null,
    transporterApplication: null,
  }));
}

// GET all users (ADMIN ONLY)
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) {
    return auth.response;
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
          // Last resort: use minimal known-safe fields to tolerate schema drift.
          const users = await fetchUsersWithMinimalSelect();
          return NextResponse.json(users);
        }
      } else {
        // For any other error, use minimal known-safe fields.
        console.warn('Query with relais failed, retrying without relations:', error);
        const users = await fetchUsersWithMinimalSelect();
        return NextResponse.json(users);
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
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const clientIp = getClientIpFromHeaders(request.headers);

    const normalizedFirstName = String(firstName || '').trim();
    const normalizedLastName = String(lastName || '').trim();
    const normalizedAddress = String(address || '').trim();
    const normalizedPhone = String(phone || '').trim();
    const fullName = String(name || `${normalizedFirstName} ${normalizedLastName}`.trim()).trim();

    // Validate required fields
    if (!fullName || !normalizedEmail || !password) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        details: 'Name, email and password are required' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
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

    if (normalizedFirstName && !isValidPersonName(normalizedFirstName)) {
      return NextResponse.json({
        error: 'Invalid first name format',
        details: 'Le prenom contient des caracteres non autorises',
      }, { status: 400 });
    }

    if (normalizedLastName && !isValidPersonName(normalizedLastName)) {
      return NextResponse.json({
        error: 'Invalid last name format',
        details: 'Le nom contient des caracteres non autorises',
      }, { status: 400 });
    }

    if (normalizedPhone && !isValidPhone(normalizedPhone)) {
      return NextResponse.json({
        error: 'Invalid phone format',
        details: 'Le format du telephone est invalide',
      }, { status: 400 });
    }

    if (normalizedAddress && normalizedAddress.length > 200) {
      return NextResponse.json({
        error: 'Invalid address format',
        details: 'Adresse trop longue (maximum 200 caracteres)',
      }, { status: 400 });
    }

    const normalizedSiret = normalizeCommerceRegisterNumber(String(siret || ''));

    const blockedIdentity = await findBlockedRelayIdentity({
      email: normalizedEmail,
      siret: normalizedSiret,
      ip: clientIp,
    });

    if (blockedIdentity) {
      return NextResponse.json({
        error: 'Blocked identity',
        code: 'BANNED_IDENTITY',
        blockedType: blockedIdentity.type,
        details: describeBlockedIdentity(blockedIdentity),
      }, { status: 403 });
    }

    if (normalizedRole === 'TRANSPORTER' && normalizedSiret && !isAlgerianCommerceRegisterNumber(normalizedSiret)) {
      return NextResponse.json({
        error: 'Invalid commerce register number format',
        details: 'Format RC algérien invalide (ex: RC-16/1234567B21)',
      }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
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
        email: normalizedEmail,
        password: hashedPassword,
        phone: normalizedPhone || null,
        role: normalizedRole,
        // Transporter accounts can be created first, then complete the RC in the application flow.
        siret: normalizedRole === 'TRANSPORTER' ? (normalizedSiret || null) : null,
        isActive: normalizedRole === 'ADMIN',
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        address: true,
        role: true,
      },
    });

    let emailConfirmationSent = false;
    try {
      const token = createEmailVerificationToken({
        userId: user.id,
        email: user.email,
      });
      const locale = request.nextUrl.searchParams.get('locale') || 'fr';
      const verificationUrl = `${request.nextUrl.origin}/api/auth/verify-email?token=${encodeURIComponent(token)}&locale=${encodeURIComponent(locale)}`;

      await sendRegistrationConfirmationEmail({
        to: user.email,
        name: user.name,
        role: user.role,
        verificationUrl,
      });
      emailConfirmationSent = true;
    } catch (mailError) {
      console.error('[users] registration confirmation email failed:', mailError);
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      role: user.role,
      emailConfirmationSent,
      requiresEmailVerification: user.role !== 'ADMIN',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ 
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
