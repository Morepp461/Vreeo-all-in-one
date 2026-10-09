import { describe, expect, it } from 'vitest';
import { parseCommonEnv } from '../src/env.js';

describe('common environment configuration', () => {
  it('uses safe development defaults', () => {
    expect(parseCommonEnv({})).toEqual({ NODE_ENV: 'development', LOG_LEVEL: 'info' });
  });

  it('rejects unsupported runtime modes', () => {
    expect(() => parseCommonEnv({ NODE_ENV: 'staging' })).toThrow('Invalid environment variables');
  });
});
