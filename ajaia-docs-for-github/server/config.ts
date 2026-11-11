import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Postgres connection string (Neon in production). When absent, an embedded PGlite database is used. */
  DATABASE_URL: z.string().url().optional(),
  PGLITE_DIR: z.string().default('.data/pglite'),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 7),
  /** Password given to the seeded demo accounts on first boot. */
  DEMO_PASSWORD: z.string().min(8).default('demo1234'),
  /** Secure (HTTPS-only, __Host-) session cookies. Defaults to on when running on Vercel. */
  SECURE_COOKIES: z.enum(['true', 'false']).optional(),
  VERCEL: z.string().optional(),
});

export type AppConfig = {
  env: 'development' | 'production' | 'test';
  isProduction: boolean;
  port: number;
  databaseUrl: string | undefined;
  pgliteDir: string;
  sessionTtlMs: number;
  demoPassword: string;
  secureCookies: boolean;
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    pgliteDir: env.PGLITE_DIR,
    sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    demoPassword: env.DEMO_PASSWORD,
    secureCookies: env.SECURE_COOKIES ? env.SECURE_COOKIES === 'true' : env.VERCEL === '1',
  };
}
