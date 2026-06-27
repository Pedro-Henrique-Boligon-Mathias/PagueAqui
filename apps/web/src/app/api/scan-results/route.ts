import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../../lib/supabase/server';
import {
  buildInvoiceInsert,
  isScanSessionReadyForInvoice,
  parseSaveInvoiceScanRequest,
  type ScanSessionForPersistence,
} from './persistence';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('Payload JSON invalido.', 400);
  }

  const parsedBody = parseSaveInvoiceScanRequest(body);

  if (!parsedBody) {
    return jsonError('Payload de leitura invalido.', 400);
  }

  const { deviceId, rawValue, sessionId } = parsedBody;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError('Nao autenticado.', 401);
  }

  const { data: pairedDevice, error: deviceError } = await supabase
    .from('paired_devices')
    .select('id')
    .eq('id', deviceId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (deviceError) {
    return jsonError(deviceError.message, 500);
  }

  if (!pairedDevice) {
    return jsonError('Celular nao pareado ou revogado.', 403);
  }

  const { data: scanSession, error: sessionError } = await supabase
    .from('scan_sessions')
    .select('id, user_id, mobile_device_id, status, expires_at')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (sessionError) {
    return jsonError(sessionError.message, 500);
  }

  if (
    !isScanSessionReadyForInvoice(
      scanSession as ScanSessionForPersistence | null,
      user.id,
      deviceId,
    )
  ) {
    return jsonError('Sessao de leitura invalida ou expirada.', 409);
  }

  let invoiceInsert: ReturnType<typeof buildInvoiceInsert>;

  try {
    invoiceInsert = buildInvoiceInsert(user.id, rawValue);
  } catch {
    return jsonError('QR Code invalido para NFC-e.', 400);
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert(invoiceInsert)
    .select('id')
    .single();

  if (invoiceError) {
    return jsonError(invoiceError.message, 500);
  }

  await supabase.from('paired_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId);
  await supabase.from('scan_sessions').update({ status: 'completed' }).eq('id', sessionId);

  return NextResponse.json({
    invoiceId: invoice.id,
    payload: invoiceInsert.raw_payload,
  });
}
