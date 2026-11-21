import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_RPM: z.coerce.number().int().positive().default(8),
  GEMINI_RPD: z.coerce.number().int().positive().default(200),
  GEMINI_THINKING: z.enum(['minimal', 'low', 'medium', 'high']).default('minimal'),

  OPENROUTER_API_KEY: optionalString,
  OPENROUTER_MODEL: z.string().default('meta-llama/llama-3.3-70b-instruct:free'),
  OPENROUTER_VISION: bool,
  OPENROUTER_RPM: z.coerce.number().int().positive().default(10),
  OPENROUTER_RPD: z.coerce.number().int().positive().default(45),

  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  FIRESTORE_ENABLED: bool,
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_SERVICE_ACCOUNT_B64: optionalString,
  SEED_DEMO_DATA: z
    .string()
    .optional()
    .transform((v) => v !== 'false'),

  STATIC_DIR: optionalString,
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Parse and validate environment variables once at start-up.
 * Fails fast with a readable message — and never echoes secret values.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && env.ADMIN_PASSWORD.startsWith('change-me')) {
    throw new Error('Refusing to start in production with the placeholder ADMIN_PASSWORD.');
  }
  return env;
}
