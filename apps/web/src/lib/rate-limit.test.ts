import { describe, expect, it } from 'vitest';

import { checkRateLimit, resetRateLimitForTests } from './rate-limit';

describe('rate limit helper', () => {
  it('limits after the configured number of attempts', () => {
    resetRateLimitForTests();

    expect(checkRateLimit('ip-1', 2, 1000, 0)).toMatchObject({ limited: false, remaining: 1 });
    expect(checkRateLimit('ip-1', 2, 1000, 100)).toMatchObject({ limited: false, remaining: 0 });
    expect(checkRateLimit('ip-1', 2, 1000, 200)).toMatchObject({ limited: true, remaining: 0 });
  });

  it('resets after the window expires', () => {
    resetRateLimitForTests();

    expect(checkRateLimit('ip-1', 1, 1000, 0)).toMatchObject({ limited: false });
    expect(checkRateLimit('ip-1', 1, 1000, 100)).toMatchObject({ limited: true });
    expect(checkRateLimit('ip-1', 1, 1000, 1001)).toMatchObject({ limited: false });
  });
});
