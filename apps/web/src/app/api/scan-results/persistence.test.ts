import { describe, expect, it } from 'vitest';

import { buildInvoiceInsert, isScanSessionReadyForInvoice, parseSaveInvoiceScanRequest } from './persistence';

const validQrUrl =
  'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260618052247000460650130000545801039901006%7C3%7C1';

describe('scan result persistence helpers', () => {
  it('validates scan persistence requests', () => {
    expect(
      parseSaveInvoiceScanRequest({
        deviceId: '6a1c5a4e-4454-47b0-9332-9a04983b5a44',
        rawValue: validQrUrl,
        sessionId: '2c80b4c4-d72f-442d-b19d-26174ae839a1',
      }),
    ).toMatchObject({ rawValue: validQrUrl });
  });

  it('rejects malformed scan persistence requests', () => {
    expect(parseSaveInvoiceScanRequest({ deviceId: 'bad', rawValue: '', sessionId: 'bad' })).toBeNull();
  });

  it('builds an invoice insert with parsed QR Code data and the authenticated user id', () => {
    expect(buildInvoiceInsert('user-1', validQrUrl)).toMatchObject({
      access_key: '43260618052247000460650130000545801039901006',
      qr_url:
        'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260618052247000460650130000545801039901006%7C3%7C1',
      raw_payload: {
        cnpj: '18052247000460',
        model: '65',
        ufCode: '43',
      },
      user_id: 'user-1',
    });
  });

  it('rejects invalid invoice QR Code payloads', () => {
    expect(() => buildInvoiceInsert('user-1', 'qualquer coisa')).toThrow();
  });

  it('accepts active sessions for the same user and paired device', () => {
    expect(
      isScanSessionReadyForInvoice(
        {
          expires_at: '2026-06-27T12:10:00.000Z',
          id: 'session-1',
          mobile_device_id: 'device-1',
          status: 'scanning',
          user_id: 'user-1',
        },
        'user-1',
        'device-1',
        new Date('2026-06-27T12:00:00.000Z'),
      ),
    ).toBe(true);
  });

  it('rejects sessions from another user', () => {
    expect(
      isScanSessionReadyForInvoice(
        {
          expires_at: '2026-06-27T12:10:00.000Z',
          id: 'session-1',
          mobile_device_id: 'device-1',
          status: 'scanning',
          user_id: 'other-user',
        },
        'user-1',
        'device-1',
        new Date('2026-06-27T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('rejects sessions for another device, including revoked-device attempts', () => {
    expect(
      isScanSessionReadyForInvoice(
        {
          expires_at: '2026-06-27T12:10:00.000Z',
          id: 'session-1',
          mobile_device_id: 'device-2',
          status: 'scanning',
          user_id: 'user-1',
        },
        'user-1',
        'device-1',
        new Date('2026-06-27T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('rejects expired sessions', () => {
    expect(
      isScanSessionReadyForInvoice(
        {
          expires_at: '2026-06-27T11:59:00.000Z',
          id: 'session-1',
          mobile_device_id: 'device-1',
          status: 'scanning',
          user_id: 'user-1',
        },
        'user-1',
        'device-1',
        new Date('2026-06-27T12:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
