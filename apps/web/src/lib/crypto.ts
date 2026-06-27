import { createHash, randomBytes } from 'node:crypto';

export function createPairingToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
