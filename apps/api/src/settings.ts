import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) =>
    typeof value === 'string'
      ? value.trim() === ''
        ? undefined
        : value.trim()
      : value,
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: z
      .string()
      .url()
      .refine((value) => new URL(value).origin === value, 'WEB_ORIGIN must contain only an origin')
      .default('http://localhost:3000'),
    DISCORD_CLIENT_ID: optionalSecret,
    DISCORD_CLIENT_SECRET: optionalSecret,
    DISCORD_REDIRECT_URI: z
      .string()
      .url()
      .default('http://localhost:4000/api/v1/auth/discord/callback'),
    SESSION_SECRET: z.string().trim().min(32).optional(),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'production') return;

    for (const key of ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'SESSION_SECRET'] as const) {
      if (!value[key]) {
        context.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production`,
        });
      }
    }

    if (value.SESSION_SECRET?.includes('replace-with-at-least-32-random-characters')) {
      context.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must be replaced before production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Do not print the whole process environment; it can contain secrets.
  throw new Error(
    `Invalid API environment: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
}

export const env = parsed.data;
