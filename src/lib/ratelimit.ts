/**
 * Rate Limiting Utility
 * Prevents brute force attacks by limiting requests per IP+User
 * Configurable limits for different endpoint categories
 */

import { NextRequest } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in ms
  maxRequests: number; // Max requests per window
  keyGenerator?: (request: NextRequest) => string; // How to generate limit key
}

interface RequestRecord {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RequestRecord>();

// Configuration presets
export const RATE_LIMIT_PRESETS = {
  strict: { windowMs: 60 * 1000, maxRequests: 5 }, // 5 req/min
  moderate: { windowMs: 60 * 1000, maxRequests: 30 }, // 30 req/min
  relaxed: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 req/min
  public: { windowMs: 60 * 1000, maxRequests: 300 }, // 300 req/min
};

/**
 * Extract client IP from request
 * Handles X-Forwarded-For, CF-Connecting-IP (Cloudflare), and direct IP
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const cloudflare = request.headers.get('cf-connecting-ip');
  if (cloudflare) {
    return cloudflare;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

/**
 * Default key generator: IP + optional user ID + endpoint
 */
function defaultKeyGenerator(request: NextRequest, userId?: string): string {
  const ip = getClientIp(request);
  const endpoint = new URL(request.url).pathname;
  const key = userId ? `${ip}:${userId}:${endpoint}` : `${ip}:${endpoint}`;
  return key;
}

/**
 * Check if request exceeds rate limit
 * Returns { limited: false } if OK
 * Returns { limited: true, retryAfter } if limit exceeded
 */
export async function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  userId?: string
): Promise<{
  limited: boolean;
  retryAfter?: number;
  remaining?: number;
}> {
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;
  const key = userId
    ? keyGenerator(request, userId)
    : keyGenerator(request);

  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // New or expired window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { limited: false, remaining: config.maxRequests - 1 };
  }

  // Within existing window
  if (record.count >= config.maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      limited: true,
      retryAfter,
      remaining: 0,
    };
  }

  // Increment counter
  record.count++;
  const remaining = config.maxRequests - record.count;

  return { limited: false, remaining };
}

/**
 * Middleware wrapper for route handlers
 */
export function withRateLimit(config: RateLimitConfig) {
  return async (request: NextRequest, userId?: string) => {
    const result = await checkRateLimit(request, config, userId);
    return result;
  };
}

/**
 * Cleanup old records periodically (optional)
 * Run this in a background job to prevent memory buildup
 */
export function cleanupExpiredRecords(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Reset rate limit for specific key (admin tool)
 */
export function resetRateLimit(userId?: string, ip?: string): boolean {
  if (!userId && !ip) return false;

  const pattern = userId || ip;
  if (!pattern) return false;

  let reset = 0;

  for (const key of rateLimitStore.keys()) {
    if (key.includes(pattern)) {
      rateLimitStore.delete(key);
      reset++;
    }
  }

  return reset > 0;
}

/**
 * Get current rate limit stats (for monitoring)
 */
export function getStats(): {
  totalKeys: number;
  totalAttempts: number;
  averagePerKey: number;
} {
  let totalAttempts = 0;

  for (const record of rateLimitStore.values()) {
    totalAttempts += record.count;
  }

  return {
    totalKeys: rateLimitStore.size,
    totalAttempts,
    averagePerKey: rateLimitStore.size > 0 ? totalAttempts / rateLimitStore.size : 0,
  };
}
