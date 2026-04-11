import { createHmac, timingSafeEqual } from 'node:crypto';

type EmailVerificationPayload = {
  userId: string;
  email: string;
  exp: number;
};

const DEFAULT_EMAIL_VERIFICATION_TTL_SECONDS = 60 * 60 * 24;

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSigningSecret() {
  const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('EMAIL_VERIFICATION_SECRET or NEXTAUTH_SECRET is required');
  }
  return secret;
}

function signPayload(encodedPayload: string) {
  return createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
}

export function createEmailVerificationToken({
  userId,
  email,
  ttlSeconds = DEFAULT_EMAIL_VERIFICATION_TTL_SECONDS,
}: {
  userId: string;
  email: string;
  ttlSeconds?: number;
}) {
  const payload: EmailVerificationPayload = {
    userId,
    email: String(email || '').trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyEmailVerificationToken(token: string): EmailVerificationPayload | null {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as EmailVerificationPayload;
    if (!payload?.userId || !payload?.email || !payload?.exp) {
      return null;
    }

    if (Math.floor(Date.now() / 1000) > payload.exp) {
      return null;
    }

    return {
      userId: payload.userId,
      email: String(payload.email).trim().toLowerCase(),
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}
