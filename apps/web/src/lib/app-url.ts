import { headers } from 'next/headers';
import { networkInterfaces } from 'node:os';

function getLanIpAddress() {
  const interfaces = networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export async function getReachablePairingUrl() {
  if (process.env.NEXT_PUBLIC_PAIRING_APP_URL) {
    return process.env.NEXT_PUBLIC_PAIRING_APP_URL;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get('x-forwarded-host');
  const host = forwardedHost ?? headerStore.get('host') ?? 'localhost:3000';
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  const requestUrl = new URL(`${protocol}://${host}`);

  if (!isLocalhost(requestUrl.hostname)) {
    return requestUrl.origin;
  }

  const lanIpAddress = getLanIpAddress();

  if (!lanIpAddress) {
    return requestUrl.origin;
  }

  requestUrl.hostname = lanIpAddress;
  return requestUrl.origin;
}
