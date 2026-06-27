import { describe, expect, it } from 'vitest';

import { getRequestIp, getSecurityRequestHashes } from './security';

describe('security helpers', () => {
  it('uses the first forwarded IP address', () => {
    const request = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.1' },
    });

    expect(getRequestIp(request)).toBe('203.0.113.10');
  });

  it('hashes request metadata without exposing raw values', () => {
    const request = new Request('https://example.com', {
      headers: {
        'user-agent': 'test-agent',
        'x-real-ip': '203.0.113.10',
      },
    });

    const hashes = getSecurityRequestHashes(request);

    expect(hashes.ipHash).toHaveLength(64);
    expect(hashes.userAgentHash).toHaveLength(64);
    expect(hashes.ipHash).not.toBe('203.0.113.10');
  });
});
