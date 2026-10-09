import { z } from "zod";

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});
const apiSchema = baseSchema.extend({
  API_HOST: z.string().trim().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
});
const botSchema = baseSchema.extend({
  DISCORD_TOKEN: z.string().trim().min(1, "DISCORD_TOKEN is required to run the bot"),
  DISCORD_CLIENT_ID: z.string().trim().min(1).optional(),
  DISCORD_DEV_GUILD_ID: z.string().trim().min(1).optional(),
});

type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
type BaseConfig = { nodeEnv: "development" | "test" | "production"; logLevel: LogLevel };
export type ApiConfig = BaseConfig & { apiHost: string; apiPort: number };
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
  return { nodeEnv: value.NODE_ENV, logLevel: value.LOG_LEVEL, apiHost: value.API_HOST, apiPort: value.API_PORT };
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
