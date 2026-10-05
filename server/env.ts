// Server configuration, validated once. Imported only by server code: secrets never reach the
// browser (nothing here is NEXT_PUBLIC_, and importing this from a client component throws).

import { z } from 'zod';

if (typeof window !== 'undefined') throw new Error('server/env.ts was imported in the browser');

const optional = z.string().trim().optional().transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6380'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  PAYMENT_PROVIDER: z.enum(['simulated', 'razorpay']).catch('simulated'),
  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,
  SIMULATED_WEBHOOK_SECRET: z.string().min(16).default('development-only-simulator-secret'),
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default('Tresor <no-reply@example.com>'),
  STORAGE_DIR: z.string().default('./storage'),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid server environment (see .env.example):\n${lines}`);
  }
  const env = parsed.data;
  if (env.PAYMENT_PROVIDER === 'razorpay' && !(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET)) {
    throw new Error('PAYMENT_PROVIDER=razorpay needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET');
  }
  if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'simulated') {
    // Allowed (demo deployments), but loudly: nothing is charged.
    console.warn('[tresor] PAYMENT_PROVIDER=simulated in production: payments are simulated, no money moves.');
  }
  return env;
}

let cached: Env | null = null;
/** Lazy so that build steps which never touch the server don't need a full environment. */
export const env = (): Env => (cached ??= load());
export const isDev = () => env().NODE_ENV !== 'production';
