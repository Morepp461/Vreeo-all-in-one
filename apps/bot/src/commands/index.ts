import type { VreeoCommand } from './types.js';
import { avatarCommand } from './avatar.js';
import { banCommand } from './moderation/ban.js';
import { caseCommand } from './moderation/case.js';
import { kickCommand } from './moderation/kick.js';
import { timeoutCommand } from './moderation/timeout.js';
import { warnCommand } from './moderation/warn.js';
import { warningsCommand } from './moderation/warnings.js';
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
  warnCommand,
  timeoutCommand,
  kickCommand,
  banCommand,
  caseCommand,
  warningsCommand,
];

export const commandMap = new Map(commands.map((command) => [command.data.name, command]));
