export type PairedDeviceSummary = {
  created_at: string;
  device_name: string;
  id: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

export function getLatestActiveDevice(devices: PairedDeviceSummary[]) {
  return [...devices]
    .filter((device) => !device.revoked_at)
    .sort((left, right) => {
      const leftSeen = left.last_seen_at ? new Date(left.last_seen_at).getTime() : 0;
      const rightSeen = right.last_seen_at ? new Date(right.last_seen_at).getTime() : 0;

      if (leftSeen !== rightSeen) {
        return rightSeen - leftSeen;
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    })[0];
}

export function createDeviceScanUrl(baseUrl: string, sessionId: string, deviceId: string) {
  const scanUrl = new URL('/scan', baseUrl);
  scanUrl.searchParams.set('session', sessionId);
  scanUrl.searchParams.set('device', deviceId);
  return scanUrl.toString();
}


export function normalizeDeviceName(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const name = value.trim().replace(/\s+/g, ' ');

  if (!name) {
    return null;
  }

  return name.slice(0, 60);
}
