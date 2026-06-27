import { z } from 'zod';

const UuidSchema = z.string().uuid();
const TimestampSchema = z.string().datetime();
const OptionalUrlSchema = z.string().trim().url().optional();
const OptionalWsUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'ws:' || url.protocol === 'wss:';
    } catch {
      return false;
    }
  }, 'Expected ws:// or wss:// URL.')
  .optional();

export const WebEnvironmentSchema = z.object({
  NEXT_ALLOWED_DEV_ORIGINS: z.string().trim().optional(),
  NEXT_PUBLIC_APP_URL: OptionalUrlSchema,
  NEXT_PUBLIC_PAIRING_APP_URL: OptionalUrlSchema,
  NEXT_PUBLIC_REALTIME_WS_URL: OptionalWsUrlSchema,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: OptionalUrlSchema,
});

export const RealtimeEnvironmentSchema = z.object({
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  REALTIME_ALLOWED_ORIGINS: z.string().trim().optional(),
});

export type WebEnvironment = z.infer<typeof WebEnvironmentSchema>;
export type RealtimeEnvironment = z.infer<typeof RealtimeEnvironmentSchema>;

export function parseWebEnvironment(env: Record<string, string | undefined>) {
  return WebEnvironmentSchema.parse(env);
}

export function parseRealtimeEnvironment(env: Record<string, string | undefined>) {
  return RealtimeEnvironmentSchema.parse(env);
}

export function parseOriginAllowlist(value?: string) {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => new URL(origin).origin);
}

const AccessKeySchema = z.string().regex(/^\d{44}$/);

export const InvoiceQrParsedPayloadSchema = z.object({
  rawValue: z.string().min(1),
  qrUrl: z.string().url(),
  accessKey: AccessKeySchema.nullable(),
  ufCode: z.string().regex(/^\d{2}$/).nullable(),
  issuedAtYearMonth: z.string().regex(/^\d{4}$/).nullable(),
  cnpj: z.string().regex(/^\d{14}$/).nullable(),
  model: z.string().regex(/^\d{2}$/).nullable(),
  series: z.string().regex(/^\d{3}$/).nullable(),
  number: z.string().regex(/^\d{9}$/).nullable(),
  emissionType: z.string().regex(/^\d$/).nullable(),
  numericCode: z.string().regex(/^\d{8}$/).nullable(),
  checkDigit: z.string().regex(/^\d$/).nullable(),
  qrParameterParts: z.array(z.string()),
});

export type InvoiceQrParsedPayload = z.infer<typeof InvoiceQrParsedPayloadSchema>;

export const ScanSessionStatusSchema = z.enum([
  'pending_pairing',
  'waiting_mobile',
  'scanning',
  'completed',
  'expired',
  'cancelled',
  'failed',
]);

export type ScanSessionStatus = z.infer<typeof ScanSessionStatusSchema>;

const ConnectionRoleSchema = z.enum(['desktop', 'mobile']);

const BaseRealtimeMessageSchema = z
  .object({
    messageId: z.string().min(1),
    sessionId: z.string().min(1),
  })
  .strict();

export const DesktopConnectedMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('desktop_connected'),
  desktopConnectionId: z.string().min(1),
});

export const MobileConnectedMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('mobile_connected'),
  mobileDeviceId: z.string().min(1),
});

export const PairingStartedMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('pairing_started'),
  pairingToken: z.string().min(1),
});

export const PairingConfirmedMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('pairing_confirmed'),
  mobileDeviceId: z.string().min(1),
});

export const ScanRequestedMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('scan_requested'),
});

export const ScanResultMessageSchema = BaseRealtimeMessageSchema.extend({
  invoiceId: UuidSchema.optional(),
  type: z.literal('scan_result'),
  payload: InvoiceQrParsedPayloadSchema,
});

export const ScanFailedMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('scan_failed'),
  reason: z.string().min(1),
});

export const SessionExpiredMessageSchema = BaseRealtimeMessageSchema.extend({
  type: z.literal('session_expired'),
});

export const RealtimeMessageSchema = z.discriminatedUnion('type', [
  DesktopConnectedMessageSchema,
  MobileConnectedMessageSchema,
  PairingStartedMessageSchema,
  PairingConfirmedMessageSchema,
  ScanRequestedMessageSchema,
  ScanResultMessageSchema,
  ScanFailedMessageSchema,
  SessionExpiredMessageSchema,
]);

export const RealtimeErrorMessageSchema = z
  .object({
    type: z.literal('error'),
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const RealtimeConnectionQuerySchema = z.object({
  role: ConnectionRoleSchema,
  sessionId: z.string().min(1),
});

export type ConnectionRole = z.infer<typeof ConnectionRoleSchema>;
export type RealtimeMessage = z.infer<typeof RealtimeMessageSchema>;
export type RealtimeErrorMessage = z.infer<typeof RealtimeErrorMessageSchema>;
export type RealtimeConnectionQuery = z.infer<typeof RealtimeConnectionQuerySchema>;

const InvoiceQrUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const lowerValue = value.toLowerCase();
    return (
      lowerValue.includes('nfce') ||
      lowerValue.includes('nfe') ||
      lowerValue.includes('fazenda') ||
      lowerValue.includes('sefaz')
    );
  }, 'QR Code must look like an invoice URL.');

export const InvoiceQrPayloadSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => InvoiceQrUrlSchema.safeParse(value).success, 'Invalid invoice QR payload.');

export type InvoiceQrPayload = z.infer<typeof InvoiceQrPayloadSchema>;

export function isValidInvoiceQrPayload(value: string) {
  return InvoiceQrPayloadSchema.safeParse(value).success;
}

function getNfceAccessKeyParts(accessKey: string | null) {
  if (!accessKey) {
    return {
      checkDigit: null,
      cnpj: null,
      emissionType: null,
      issuedAtYearMonth: null,
      model: null,
      number: null,
      numericCode: null,
      series: null,
      ufCode: null,
    };
  }

  return {
    checkDigit: accessKey.slice(43, 44),
    cnpj: accessKey.slice(6, 20),
    emissionType: accessKey.slice(34, 35),
    issuedAtYearMonth: accessKey.slice(2, 6),
    model: accessKey.slice(20, 22),
    number: accessKey.slice(25, 34),
    numericCode: accessKey.slice(35, 43),
    series: accessKey.slice(22, 25),
    ufCode: accessKey.slice(0, 2),
  };
}

export function parseInvoiceQrPayload(value: string): InvoiceQrParsedPayload {
  const rawValue = InvoiceQrPayloadSchema.parse(value);
  const url = new URL(rawValue);
  const qrParameter = url.searchParams.get('p') ?? '';
  const qrParameterParts = qrParameter ? qrParameter.split('|') : [];
  const accessKey =
    qrParameterParts.find((part) => AccessKeySchema.safeParse(part).success) ??
    rawValue.match(/\d{44}/)?.[0] ??
    null;

  return InvoiceQrParsedPayloadSchema.parse({
    ...getNfceAccessKeyParts(accessKey),
    accessKey,
    qrParameterParts,
    qrUrl: url.toString(),
    rawValue,
  });
}

export const ProfileSchema = z.object({
  id: UuidSchema,
  fullName: z.string().nullable(),
  createdAt: TimestampSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;

export const PairedDeviceSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  deviceName: z.string().min(1),
  deviceFingerprintHash: z.string().min(1),
  devicePublicTokenHash: z.string().min(1),
  lastSeenAt: TimestampSchema.nullable(),
  revokedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
});

export type PairedDevice = z.infer<typeof PairedDeviceSchema>;

export const ScanSessionSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  desktopConnectionId: z.string().min(1),
  mobileDeviceId: UuidSchema.nullable(),
  pairingConfirmedAt: TimestampSchema.nullable().optional(),
  pairingTokenHash: z.string().nullable().optional(),
  status: ScanSessionStatusSchema,
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
});

export type ScanSession = z.infer<typeof ScanSessionSchema>;

export const InvoiceSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  accessKey: z.string().nullable(),
  qrUrl: z.string().url(),
  issuerName: z.string().nullable(),
  totalAmount: z.number().nonnegative().nullable(),
  purchasedAt: TimestampSchema.nullable(),
  rawPayload: z.record(z.unknown()),
  createdAt: TimestampSchema,
});

export type Invoice = z.infer<typeof InvoiceSchema>;

export const InvoiceItemSchema = z.object({
  id: UuidSchema,
  invoiceId: UuidSchema,
  userId: UuidSchema,
  name: z.string().min(1),
  quantity: z.number().nonnegative().nullable(),
  unitPrice: z.number().nonnegative().nullable(),
  totalPrice: z.number().nonnegative().nullable(),
  rawPayload: z.record(z.unknown()),
  createdAt: TimestampSchema,
});

export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

export const SecurityEventSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema.nullable(),
  eventType: z.string().min(1),
  ipHash: z.string().nullable(),
  userAgentHash: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: TimestampSchema,
});

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

export const HealthResponseSchema = z.object({
  service: z.string().min(1),
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export function createHealthResponse(service: string, now = new Date()): HealthResponse {
  return HealthResponseSchema.parse({
    service,
    status: 'ok',
    timestamp: now.toISOString(),
  });
}
