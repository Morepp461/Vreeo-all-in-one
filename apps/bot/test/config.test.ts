import { describe, expect, it } from 'vitest';
import { getBotToken } from '../src/config.js';

describe('Discord bot configuration', () => {
  it('accepts a non-empty bot token', () => {
    expect(getBotToken({ DISCORD_BOT_TOKEN: 'test-token' })).toBe('test-token');
  });

  it('rejects a missing or blank bot token', () => {
    expect(() => getBotToken({})).toThrow('DISCORD_BOT_TOKEN is required');
    expect(() => getBotToken({ DISCORD_BOT_TOKEN: '  ' })).toThrow('DISCORD_BOT_TOKEN is required');
  });
});
