import type { VreeoCommand } from './types.js';
import { avatarCommand } from './avatar.js';
import { helpCommand } from './help.js';
import { pingCommand } from './ping.js';
import { pollCommand } from './poll.js';
import { serverInfoCommand } from './serverinfo.js';
import { userInfoCommand } from './userinfo.js';

export const commands: VreeoCommand[] = [
  pingCommand,
  helpCommand,
  serverInfoCommand,
  userInfoCommand,
  avatarCommand,
  pollCommand,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
