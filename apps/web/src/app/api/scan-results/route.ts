import { NextResponse } from 'next/server';

import { checkRateLimit } from '../../../lib/rate-limit';
import { getRequestIp, logSecurityEvent } from '../../../lib/security';
import { createServerSupabaseClient } from '../../../lib/supabase/server';
import { applyInvoiceEnrichment, fetchInvoiceEnrichmentDetailed } from './enrichment';
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
  const rateLimitKey = `scan-results:${getRequestIp(request) ?? 'unknown'}`;
  const rateLimit = checkRateLimit(rateLimitKey, 30, 60_000);

  if (rateLimit.limited) {
    return jsonError('Muitas tentativas. Aguarde um minuto e tente novamente.', 429);
  }

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
    await logSecurityEvent(supabase, request, 'scan_result_device_rejected', user.id, { deviceId });
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
    await logSecurityEvent(supabase, request, 'scan_result_session_rejected', user.id, {
      deviceId,
      sessionId,
      sessionStatus: scanSession?.status ?? null,
    });
    return jsonError('Sessao de leitura invalida ou expirada.', 409);
  }

  let invoiceInsert: ReturnType<typeof buildInvoiceInsert>;

  try {
    invoiceInsert = buildInvoiceInsert(user.id, rawValue);
  } catch {
    await logSecurityEvent(supabase, request, 'scan_result_payload_rejected', user.id, { deviceId, sessionId });
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

  const fetchResult = await fetchInvoiceEnrichmentDetailed(invoiceInsert.qr_url);
  const enrichmentResult = await applyInvoiceEnrichment(
    supabase,
    {
      id: invoice.id,
      rawPayload: invoiceInsert.raw_payload,
      userId: user.id,
    },
    fetchResult.enrichment,
  );

  if (enrichmentResult.status === 'invoice_update_failed') {
    console.error('NFC-e enrichment invoice update failed', {
      error: enrichmentResult.error,
      invoiceId: invoice.id,
    });
  }

  if (enrichmentResult.status === 'items_insert_failed') {
    console.error('NFC-e enrichment items insert failed', {
      error: enrichmentResult.error,
      invoiceId: invoice.id,
      itemCount: enrichmentResult.itemCount,
    });
  }

  console.info('NFC-e enrichment finished', {
    invoiceId: invoice.id,
    itemCount: enrichmentResult.itemCount,
    status: enrichmentResult.status,
    reason: fetchResult.reason,
    reasonMessage: fetchResult.message,
    totalAmount: fetchResult.enrichment?.totalAmount ?? null,
  });


  await supabase.from('paired_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', deviceId);
  await supabase.from('scan_sessions').update({ status: 'completed' }).eq('id', sessionId);
  await logSecurityEvent(supabase, request, 'scan_result_saved', user.id, {
    accessKey: invoiceInsert.access_key,
    deviceId,
    enrichmentError: enrichmentResult.error,
    enrichmentStatus: enrichmentResult.status,
    invoiceId: invoice.id,
    itemCount: enrichmentResult.itemCount,
    sessionId,
  });

  return NextResponse.json({
    enrichment: {
      error: enrichmentResult.error,
      itemCount: enrichmentResult.itemCount,
      status: enrichmentResult.status,
    },
    invoiceId: invoice.id,
    payload: invoiceInsert.raw_payload,
  });
}
