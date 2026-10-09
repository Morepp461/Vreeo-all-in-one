import { describe, expect, it } from 'vitest';
import { auditReason, parseReason } from '../src/commands/moderation/shared.js';

describe('moderation input safety', () => {
  it('normalizes missing, empty, and too-short reasons', () => {
    expect(parseReason(null)).toBe('No reason provided');
    expect(parseReason('  ')).toBe('No reason provided');
    expect(parseReason('ok')).toBe('No reason provided');
    expect(parseReason('  rule violation  ')).toBe('rule violation');
  });

  it('caps stored reason length', () => {
    expect(parseReason('x'.repeat(600))).toHaveLength(500);
  });

  it('caps Discord audit log reasons to the API limit', () => {
    expect(auditReason(12n, 'moderator#0001', '123456789', 'x'.repeat(600))).toHaveLength(512);
  });
});
