import { z } from "zod";

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});
const postgresUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "postgres:" || protocol === "postgresql:";
}, "must use a PostgreSQL URL");
const redisUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "redis:" || protocol === "rediss:";
}, "must use a Redis URL");
const optionalNonEmptyString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);
const optionalUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().url().refine((value) => {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      url.username.length === 0 && url.password.length === 0 && url.hash.length === 0;
  }, "must be an HTTP(S) redirect URL without credentials or fragments").optional(),
);
const appBaseUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "must use an HTTP(S) origin");
const apiSchema = baseSchema.extend({
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: postgresUrlSchema.optional(),
  REDIS_URL: redisUrlSchema.optional(),
  DISCORD_CLIENT_ID: optionalNonEmptyString,
  DISCORD_CLIENT_SECRET: optionalNonEmptyString,
  DISCORD_REDIRECT_URI: optionalUrl,
  APP_BASE_URL: appBaseUrlSchema.default("http://localhost:3000"),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(2_592_000).default(604_800),
  SESSION_COOKIE_NAME: z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/).default("vreeo_session"),
  SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  SESSION_COOKIE_SECURE: z.preprocess(
    (value) => value === "true" ? true : value === "false" ? false : value,
    z.boolean().default(false),
  ),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.DATABASE_URL) context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "is required in production" });
  if (value.NODE_ENV === "production" && !value.REDIS_URL) context.addIssue({ code: z.ZodIssueCode.custom, path: ["REDIS_URL"], message: "is required in production" });
  const oauthValues = [value.DISCORD_CLIENT_ID, value.DISCORD_CLIENT_SECRET, value.DISCORD_REDIRECT_URI];
  const oauthConfigured = oauthValues.every((item) => item !== undefined);
  const oauthPartial = oauthValues.some((item) => item !== undefined) && !oauthConfigured;
  if (oauthPartial) context.addIssue({ code: z.ZodIssueCode.custom, path: ["DISCORD_CLIENT_ID"], message: "DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, and DISCORD_REDIRECT_URI must be configured together" });
  if (value.NODE_ENV === "production" && !oauthConfigured) context.addIssue({ code: z.ZodIssueCode.custom, path: ["DISCORD_CLIENT_SECRET"], message: "Discord OAuth credentials are required in production" });
  if (value.NODE_ENV === "production" && new URL(value.APP_BASE_URL).protocol !== "https:") context.addIssue({ code: z.ZodIssueCode.custom, path: ["APP_BASE_URL"], message: "must use HTTPS in production" });
  if (value.NODE_ENV === "production" && value.DISCORD_REDIRECT_URI && new URL(value.DISCORD_REDIRECT_URI).protocol !== "https:") context.addIssue({ code: z.ZodIssueCode.custom, path: ["DISCORD_REDIRECT_URI"], message: "must use HTTPS in production" });
  if (value.NODE_ENV === "production" && !value.SESSION_COOKIE_SECURE) context.addIssue({ code: z.ZodIssueCode.custom, path: ["SESSION_COOKIE_SECURE"], message: "must be true in production" });
  if (value.SESSION_COOKIE_SAME_SITE === "none" && !value.SESSION_COOKIE_SECURE) context.addIssue({ code: z.ZodIssueCode.custom, path: ["SESSION_COOKIE_SECURE"], message: "must be true when SameSite=None" });
});
const botSchema = baseSchema.extend({
  DISCORD_TOKEN: z.string().trim().min(1, "DISCORD_TOKEN is required to run the bot"),
  DISCORD_CLIENT_ID: z.string().trim().optional(),
  DISCORD_DEV_GUILD_ID: z.string().trim().optional(),
  DATABASE_URL: postgresUrlSchema.optional(),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "is required in production" });
  }
});

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
type BaseConfig = { nodeEnv: "development" | "test" | "production"; logLevel: LogLevel };
export type DiscordOAuthConfig = { clientId: string; clientSecret: string; redirectUri: string };
export type ApiConfig = BaseConfig & {
  apiHost: string; apiPort: number; databaseUrl: string; redisUrl: string;
  discordOAuth: DiscordOAuthConfig | null; appBaseUrl: string; sessionTtlSeconds: number;
  sessionCookieName: string; sessionCookieSameSite: "lax" | "strict" | "none"; sessionCookieSecure: boolean;
};
export type BotConfig = BaseConfig & { discordToken: string; databaseUrl: string; discordClientId?: string; discordDevGuildId?: string };

function parse<T extends z.ZodTypeAny>(schema: T, environment: NodeJS.ProcessEnv): z.infer<T> {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const value = parse(apiSchema, environment);
  const discordOAuth = value.DISCORD_CLIENT_ID && value.DISCORD_CLIENT_SECRET && value.DISCORD_REDIRECT_URI
    ? { clientId: value.DISCORD_CLIENT_ID, clientSecret: value.DISCORD_CLIENT_SECRET, redirectUri: value.DISCORD_REDIRECT_URI }
    : null;
  return {
    nodeEnv: value.NODE_ENV, logLevel: value.LOG_LEVEL, apiHost: value.API_HOST, apiPort: value.API_PORT,
    databaseUrl: value.DATABASE_URL ?? "postgresql://vreeo:vreeo_dev_only@127.0.0.1:5432/vreeo?schema=public",
    redisUrl: value.REDIS_URL ?? "redis://127.0.0.1:6379", discordOAuth,
    appBaseUrl: new URL(value.APP_BASE_URL).origin, sessionTtlSeconds: value.SESSION_TTL_SECONDS,
    sessionCookieName: value.SESSION_COOKIE_NAME, sessionCookieSameSite: value.SESSION_COOKIE_SAME_SITE,
    sessionCookieSecure: value.SESSION_COOKIE_SECURE,
  };
}

export function loadBotConfig(environment: NodeJS.ProcessEnv = process.env): BotConfig {
  const value = parse(botSchema, environment);
  return {
    nodeEnv: value.NODE_ENV, logLevel: value.LOG_LEVEL, discordToken: value.DISCORD_TOKEN,
    databaseUrl: value.DATABASE_URL ?? "postgresql://vreeo:vreeo_dev_only@127.0.0.1:5432/vreeo?schema=public",
    ...(value.DISCORD_CLIENT_ID ? { discordClientId: value.DISCORD_CLIENT_ID } : {}),
    ...(value.DISCORD_DEV_GUILD_ID ? { discordDevGuildId: value.DISCORD_DEV_GUILD_ID } : {}),
  };
}
