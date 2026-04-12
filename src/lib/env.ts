import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

function isProductionRuntime(env: ServerEnv) {
  return env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build';
}

function formatZodIssues(error: z.ZodError) {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || 'env';
    return `${path}: ${issue.message}`;
  }).join('; ');
}

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`[env] Invalid environment configuration: ${formatZodIssues(parsed.error)}`);
  }

  const validated = parsed.data;

  if (isProductionRuntime(validated)) {
    if (!validated.NEXTAUTH_SECRET) {
      throw new Error('[env] NEXTAUTH_SECRET est obligatoire en production.');
    }

    if (!validated.DATABASE_URL) {
      throw new Error('[env] DATABASE_URL est obligatoire en production.');
    }
  }

  return validated;
}

export function getEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }

  return cachedEnv;
}

export const env = new Proxy({} as ServerEnv, {
  get(_target, prop) {
    return getEnv()[prop as keyof ServerEnv];
  },
});

export function getAllowedCorsOrigins() {
  const configuredOrigins = (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set([
    ...configuredOrigins,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXTAUTH_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ].filter((value): value is string => Boolean(value)));
}
