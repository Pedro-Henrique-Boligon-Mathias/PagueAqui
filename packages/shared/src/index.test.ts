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
  parseOriginAllowlist,
  parseRealtimeEnvironment,
  parseWebEnvironment,
} from './index';

describe('shared schemas', () => {


  it('validates web environment variables', () => {
    expect(
      parseWebEnvironment({
        NEXT_PUBLIC_REALTIME_WS_URL: 'wss://realtime.example.com/ws',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      }),
    ).toMatchObject({ NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' });
  });

  it('rejects invalid web websocket environment variables', () => {
    expect(() => parseWebEnvironment({ NEXT_PUBLIC_REALTIME_WS_URL: 'https://example.com/ws' })).toThrow();
  });

  it('validates realtime environment variables', () => {
    expect(parseRealtimeEnvironment({ PORT: '4444', REALTIME_ALLOWED_ORIGINS: 'https://app.example.com' })).toMatchObject({
      HOST: '0.0.0.0',
      PORT: 4444,
    });
  });

  it('rejects invalid realtime ports', () => {
    expect(() => parseRealtimeEnvironment({ PORT: '99999' })).toThrow();
  });

  it('parses origin allowlists', () => {
    expect(parseOriginAllowlist('https://a.example.com/path, https://b.example.com')).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

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
