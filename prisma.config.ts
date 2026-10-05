import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Next.js reads .env.local then .env; the Prisma CLI does the same here.
config({ path: ['.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
