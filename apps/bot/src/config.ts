import { z } from 'zod';

const botEnvSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().trim().min(1),
});

export function getBotToken(source: NodeJS.ProcessEnv = process.env): string {
  const parsed = botEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error('DISCORD_BOT_TOKEN is required to start the Discord bot.');
  }
  return parsed.data.DISCORD_BOT_TOKEN;
}
