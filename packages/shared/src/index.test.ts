import { describe, expect, it } from 'vitest';

import {
  InvoiceSchema,
  InvoiceQrPayloadSchema,
  ProfileSchema,
  RealtimeConnectionQuerySchema,
  RealtimeMessageSchema,
  ScanSessionStatusSchema,
  createHealthResponse,
  parseInvoiceQrPayload,
} from './index';

describe('shared schemas', () => {
  it('validates scan session statuses', () => {
    expect(ScanSessionStatusSchema.parse('pending_pairing')).toBe('pending_pairing');
  });

  it('creates a typed health response', () => {
    expect(createHealthResponse('shared', new Date('2026-01-01T00:00:00.000Z'))).toEqual({
      service: 'shared',
      status: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('validates profile entities', () => {
    expect(
      ProfileSchema.parse({
        id: '6a1c5a4e-4454-47b0-9332-9a04983b5a44',
        fullName: null,
        createdAt: '2026-06-27T00:00:00.000Z',
      }),
    ).toMatchObject({ fullName: null });
  });

  it('rejects invalid invoice URLs', () => {
    expect(() =>
      InvoiceSchema.parse({
        id: '6a1c5a4e-4454-47b0-9332-9a04983b5a44',
        userId: '2c80b4c4-d72f-442d-b19d-26174ae839a1',
        accessKey: null,
        qrUrl: 'sem-url',
        issuerName: null,
        totalAmount: null,
        purchasedAt: null,
        rawPayload: {},
        createdAt: '2026-06-27T00:00:00.000Z',
      }),
    ).toThrow();
  });

  it('validates realtime messages', () => {
    expect(
      RealtimeMessageSchema.parse({
        invoiceId: '6a1c5a4e-4454-47b0-9332-9a04983b5a44',
        messageId: 'msg-1',
        sessionId: 'session-1',
        type: 'scan_result',
        payload: parseInvoiceQrPayload(
          'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260618052247000460650130000545801039901006%7C3%7C1',
        ),
      }),
    ).toMatchObject({ type: 'scan_result' });
  });

  it('rejects invalid realtime connection roles', () => {
    expect(() =>
      RealtimeConnectionQuerySchema.parse({ role: 'kitchen', sessionId: 'session-1' }),
    ).toThrow();
  });

  it('accepts invoice QR Code URLs', () => {
    expect(InvoiceQrPayloadSchema.parse('https://www.fazenda.sp.gov.br/nfce/qrcode?p=123')).toContain(
      'nfce',
    );
  });

  it('parses basic NFC-e QR Code data', () => {
    expect(
      parseInvoiceQrPayload(
        'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=43260618052247000460650130000545801039901006%7C3%7C1',
      ),
    ).toMatchObject({
      accessKey: '43260618052247000460650130000545801039901006',
      cnpj: '18052247000460',
      model: '65',
      qrParameterParts: ['43260618052247000460650130000545801039901006', '3', '1'],
      ufCode: '43',
    });
  });

  it('rejects empty invoice QR Code payloads', () => {
    expect(() => InvoiceQrPayloadSchema.parse('')).toThrow();
  });

  it('rejects random invoice QR Code payloads', () => {
    expect(() => InvoiceQrPayloadSchema.parse('qualquer texto')).toThrow();
  });
});
