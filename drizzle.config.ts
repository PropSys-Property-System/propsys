import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/server/db/schema.ts',
  out: './lib/server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;


