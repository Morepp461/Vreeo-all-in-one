import { describe, expect, it } from 'vitest';
import { commands, commandMap } from '../src/commands/index.js';

describe('slash command registry', () => {
  it('has unique valid command names', () => {
    const names = commands.map((command) => command.data.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9-]{1,32}$/);
  });

  it('contains the expected general and server utility commands', () => {
    expect([...commandMap.keys()]).toEqual([
      'ping',
      'help',
      'serverinfo',
      'userinfo',
      'avatar',
      'poll',
      'warn',
      'timeout',
      'kick',
      'ban',
      'case',
      'warnings',
    ]);
  });

  it('serializes each command for Discord API registration', () => {
    for (const command of commands) {
      expect(command.data.toJSON()).toMatchObject({
        name: command.data.name,
        description: expect.any(String),
      });
    }
  });
});
