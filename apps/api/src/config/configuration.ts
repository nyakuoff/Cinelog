import { z } from 'zod';

/**
 * Environment schema. Parsed once at boot; a bad/missing var fails fast with a
 * readable error instead of surfacing as a mysterious runtime bug later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().default(3000),
  DATA_DIR: z.string().default('./data'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900), // seconds
  JWT_REFRESH_TTL: z.coerce.number().int().default(2592000), // seconds

  TMDB_API_KEY: z.string().default(''),
  TMDB_ACCESS_TOKEN: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  nodeEnv: Env['NODE_ENV'];
  port: number;
  dataDir: string;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
  };
  tmdb: {
    apiKey: string;
    accessToken: string;
  };
}

/** Config factory consumed by @nestjs/config. */
export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    port: env.API_PORT,
    dataDir: env.DATA_DIR,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    tmdb: {
      apiKey: env.TMDB_API_KEY,
      accessToken: env.TMDB_ACCESS_TOKEN,
    },
  };
}
