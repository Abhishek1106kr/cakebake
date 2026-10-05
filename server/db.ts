// One Prisma client per process (reused across hot reloads in development).

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client';
import { env } from './env';

const g = globalThis as unknown as { __tresorDb?: PrismaClient };

function create() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env().DATABASE_URL, max: 10 }) });
}

export const db: PrismaClient = g.__tresorDb ?? create();
if (env().NODE_ENV !== 'production') g.__tresorDb = db;

export type Tx = Prisma.TransactionClient;
/** Runs `fn` in a transaction (serializable where money or stock is involved: pass isolationLevel). */
export const tx = <T>(fn: (t: Tx) => Promise<T>, opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeout?: number }) =>
  db.$transaction(fn, { maxWait: 5000, timeout: opts?.timeout ?? 15000, isolationLevel: opts?.isolationLevel });
