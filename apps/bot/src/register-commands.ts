import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { z } from 'zod';
import { commands } from './commands/index.js';

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().trim().min(1),
  DISCORD_CLIENT_ID: z.string().regex(/^\d{17,20}$/),
  DISCORD_GUILD_ID: z
    .string()
    .regex(/^\d{17,20}$/)
    .optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    'DISCORD_BOT_TOKEN and a valid DISCORD_CLIENT_ID are required to register commands.',
  );
}

const env = parsed.data;
const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);
const route = env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

try {
  await rest.put(route, { body: commands.map((command) => command.data.toJSON()) });
  console.info(
    `Registered ${commands.length} VREEO commands ${env.DISCORD_GUILD_ID ? 'for the configured test server' : 'globally'}.`,
  );
} catch (error) {
  console.error(
    'Slash-command registration failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
}
