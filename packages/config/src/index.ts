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
const apiSchema = baseSchema.extend({
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: postgresUrlSchema.optional(),
  REDIS_URL: redisUrlSchema.optional(),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "is required in production" });
  }
  if (value.NODE_ENV === "production" && !value.REDIS_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["REDIS_URL"], message: "is required in production" });
  }
});
const botSchema = baseSchema.extend({
  DISCORD_TOKEN: z.string().trim().min(1, "DISCORD_TOKEN is required to run the bot"),
  DISCORD_CLIENT_ID: z.string().trim().optional(),
  DISCORD_DEV_GUILD_ID: z.string().trim().optional(),
});

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
type BaseConfig = { nodeEnv: "development" | "test" | "production"; logLevel: LogLevel };
export type ApiConfig = BaseConfig & {
  apiHost: string;
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
};
export type BotConfig = BaseConfig & { discordToken: string; discordClientId?: string; discordDevGuildId?: string };

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
  return {
    nodeEnv: value.NODE_ENV,
    logLevel: value.LOG_LEVEL,
    apiHost: value.API_HOST,
    apiPort: value.API_PORT,
    databaseUrl: value.DATABASE_URL ?? "postgresql://vreeo:vreeo_dev_only@127.0.0.1:5432/vreeo?schema=public",
    redisUrl: value.REDIS_URL ?? "redis://127.0.0.1:6379",
  };
}

export function loadBotConfig(environment: NodeJS.ProcessEnv = process.env): BotConfig {
  const value = parse(botSchema, environment);
  return {
    nodeEnv: value.NODE_ENV,
    logLevel: value.LOG_LEVEL,
    discordToken: value.DISCORD_TOKEN,
    ...(value.DISCORD_CLIENT_ID ? { discordClientId: value.DISCORD_CLIENT_ID } : {}),
    ...(value.DISCORD_DEV_GUILD_ID ? { discordDevGuildId: value.DISCORD_DEV_GUILD_ID } : {}),
  };
}
