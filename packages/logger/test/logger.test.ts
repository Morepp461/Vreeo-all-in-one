import { describe, expect, it } from 'vitest';
import { createLogger } from '../src/index.js';

describe('structured logger', () => {
  it('includes the service name in logger bindings', () => {
    const logger = createLogger('unit-test-service');
    expect(logger.bindings()).toMatchObject({ name: 'unit-test-service' });
    logger.flush();
  });
});
