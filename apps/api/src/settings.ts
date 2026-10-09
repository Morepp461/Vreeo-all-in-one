import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Do not print the whole process environment; it can contain secrets.
  throw new Error(
    `Invalid API environment: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
}

export const env = parsed.data;
