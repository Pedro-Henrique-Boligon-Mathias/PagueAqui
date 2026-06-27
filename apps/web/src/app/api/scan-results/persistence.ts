import { parseInvoiceQrPayload } from '@leitor-nfce/shared';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SaveInvoiceScanRequest = {
  deviceId: string;
  rawValue: string;
  sessionId: string;
};

export type ScanSessionForPersistence = {
  expires_at: string;
  id: string;
  mobile_device_id: string | null;
  status: string;
  user_id: string;
};

export function buildInvoiceInsert(userId: string, rawValue: string) {
  const payload = parseInvoiceQrPayload(rawValue);

  return {
    access_key: payload.accessKey,
    issuer_name: null,
    purchased_at: null,
    qr_url: payload.qrUrl,
    raw_payload: payload,
    total_amount: null,
    user_id: userId,
  };
}

export function parseSaveInvoiceScanRequest(value: unknown): SaveInvoiceScanRequest | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const { deviceId, rawValue, sessionId } = record;

  if (
    typeof deviceId !== 'string' ||
    typeof rawValue !== 'string' ||
    typeof sessionId !== 'string' ||
    !uuidPattern.test(deviceId) ||
    !uuidPattern.test(sessionId) ||
    !rawValue.trim()
  ) {
    return null;
  }

  return {
    deviceId,
    rawValue: rawValue.trim(),
    sessionId,
  };
}

export function isScanSessionReadyForInvoice(
  scanSession: ScanSessionForPersistence | null,
  userId: string,
  deviceId: string,
  now = new Date(),
) {
  if (!scanSession) {
    return false;
  }

  return (
    scanSession.user_id === userId &&
    scanSession.mobile_device_id === deviceId &&
    ['waiting_mobile', 'scanning'].includes(scanSession.status) &&
    new Date(scanSession.expires_at).getTime() > now.getTime()
  );
}
