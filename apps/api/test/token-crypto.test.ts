import { describe, expect, it } from 'vitest';
import { decryptOAuthToken, encryptOAuthToken } from '../src/auth/token-crypto.js';

const secret = 'test-key-that-is-at-least-thirty-two-characters';

describe('OAuth token encryption', () => {
  it('round-trips tokens without storing the plaintext', () => {
    const token = 'discord-access-token-do-not-log';
    const encrypted = encryptOAuthToken(token, secret);
    expect(encrypted).not.toContain(token);
    expect(decryptOAuthToken(encrypted, secret)).toBe(token);
  });

  it('uses a fresh nonce for each encryption', () => {
    const first = encryptOAuthToken('same-token', secret);
    const second = encryptOAuthToken('same-token', secret);
    expect(first).not.toBe(second);
    expect(decryptOAuthToken(first, secret)).toBe('same-token');
    expect(decryptOAuthToken(second, secret)).toBe('same-token');
  });

  it('rejects modified ciphertext and wrong keys', () => {
    const encrypted = encryptOAuthToken('secret-token', secret);
    const parts = encrypted.split('.');
    const ciphertext = parts[3];
    if (!ciphertext) throw new Error('Ciphertext segment missing from test fixture.');
    parts[3] = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('A') ? 'B' : 'A'}`;
    expect(() => decryptOAuthToken(parts.join('.'), secret)).toThrow();
    expect(() => decryptOAuthToken(encrypted, 'a-different-key-that-is-long-enough')).toThrow();
  });
});
