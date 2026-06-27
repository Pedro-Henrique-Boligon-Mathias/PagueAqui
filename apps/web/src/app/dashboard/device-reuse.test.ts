import { describe, expect, it } from 'vitest';

import { createDeviceScanUrl, getLatestActiveDevice, type PairedDeviceSummary } from './device-reuse';

const baseDevice: PairedDeviceSummary = {
  created_at: '2026-06-27T00:00:00.000Z',
  device_name: 'Celular',
  id: 'device-1',
  last_seen_at: null,
  revoked_at: null,
};

describe('device reuse helpers', () => {
  it('finds the latest active paired device', () => {
    expect(
      getLatestActiveDevice([
        { ...baseDevice, id: 'older', last_seen_at: '2026-06-27T00:01:00.000Z' },
        { ...baseDevice, id: 'newer', last_seen_at: '2026-06-27T00:02:00.000Z' },
      ]),
    ).toMatchObject({ id: 'newer' });
  });

  it('ignores revoked devices', () => {
    expect(
      getLatestActiveDevice([
        { ...baseDevice, id: 'revoked', last_seen_at: '2026-06-27T00:03:00.000Z', revoked_at: '2026-06-27T00:04:00.000Z' },
        { ...baseDevice, id: 'active', last_seen_at: '2026-06-27T00:02:00.000Z' },
      ]),
    ).toMatchObject({ id: 'active' });
  });

  it('falls back to creation date when a device has never been seen', () => {
    expect(
      getLatestActiveDevice([
        { ...baseDevice, id: 'older', created_at: '2026-06-27T00:01:00.000Z' },
        { ...baseDevice, id: 'newer', created_at: '2026-06-27T00:02:00.000Z' },
      ]),
    ).toMatchObject({ id: 'newer' });
  });

  it('creates a mobile scan URL for a reused device', () => {
    expect(createDeviceScanUrl('https://app.example.com', 'session-1', 'device-1')).toBe(
      'https://app.example.com/scan?session=session-1&device=device-1',
    );
  });
});
