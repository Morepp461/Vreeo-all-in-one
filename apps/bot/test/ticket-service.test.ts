import { describe, expect, it } from 'vitest';
import { readTicketSettings } from '../src/services/ticket-service.js';

describe('ticket settings validation', () => {
  it('accepts valid Discord snowflake IDs and preserves feature enablement', () => {
    expect(
      readTicketSettings(
        {
          ticketCategoryId: '123456789012345678',
          ticketStaffRoleId: '987654321098765432',
        },
        true,
      ),
    ).toEqual({
      enabled: true,
      ticketCategoryId: '123456789012345678',
      staffRoleId: '987654321098765432',
    });
  });

  it('rejects malformed IDs instead of passing them to Discord API calls', () => {
    expect(
      readTicketSettings({
        ticketCategoryId: 'not-a-snowflake',
        ticketStaffRoleId: '123',
      }),
    ).toEqual({
      enabled: false,
      ticketCategoryId: null,
      staffRoleId: null,
    });
  });

  it('treats null, arrays, and primitive configs as empty configuration', () => {
    for (const config of [null, undefined, [], 'bad-config', 42]) {
      expect(readTicketSettings(config, true)).toEqual({
        enabled: true,
        ticketCategoryId: null,
        staffRoleId: null,
      });
    }
  });

  it('does not enable the ticket feature unless explicitly enabled', () => {
    expect(readTicketSettings({ ticketCategoryId: '123456789012345678' }).enabled).toBe(false);
  });
});
