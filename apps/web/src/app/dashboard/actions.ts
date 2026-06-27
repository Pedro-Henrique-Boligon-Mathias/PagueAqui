'use server';

import { redirect } from 'next/navigation';

import { applyInvoiceEnrichment, fetchInvoiceEnrichmentDetailed } from '../api/scan-results/enrichment';
import { createServerSupabaseClient } from '../../lib/supabase/server';
import {
  getDashboardErrorUrl,
  getDashboardMessageUrl,
  normalizeOptionalText,
  parseOptionalDateTime,
  parseOptionalDecimal,
  requireText,
} from './manual-entry';

async function getAuthenticatedSupabase() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return { supabase, user };
}

async function ensureOwnInvoice(invoiceId: string) {
  const { supabase, user } = await getAuthenticatedSupabase();
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!invoice) {
    throw new Error('Nota nao encontrada para este usuario.');
  }

  return { supabase, user };
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function updateInvoice(formData: FormData) {
  let redirectUrl = getDashboardMessageUrl('Nota atualizada.');

  try {
    const invoiceId = requireText(formData.get('invoiceId'), 'Nota');
    const { supabase } = await ensureOwnInvoice(invoiceId);

    const { error } = await supabase
      .from('invoices')
      .update({
        issuer_name: normalizeOptionalText(formData.get('issuerName')),
        purchased_at: parseOptionalDateTime(formData.get('purchasedAt')),
        total_amount: parseOptionalDecimal(formData.get('totalAmount')),
      })
      .eq('id', invoiceId);

    if (error) {
      throw error;
    }

    redirectUrl = getDashboardMessageUrl('Nota atualizada.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel atualizar a nota.';
    redirectUrl = getDashboardErrorUrl(message);
  }

  redirect(redirectUrl);
}


export async function extractInvoiceData(formData: FormData) {
  let redirectUrl = getDashboardMessageUrl('Dados extraidos da nota.');

  try {
    const invoiceId = requireText(formData.get('invoiceId'), 'Nota');
    const { supabase, user } = await ensureOwnInvoice(invoiceId);
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, qr_url, raw_payload')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      throw new Error('Nota nao encontrada para este usuario.');
    }

    const fetchResult = await fetchInvoiceEnrichmentDetailed(invoice.qr_url);
    const enrichmentResult = await applyInvoiceEnrichment(
      supabase,
      {
        id: invoice.id,
        rawPayload:
          invoice.raw_payload && typeof invoice.raw_payload === 'object'
            ? (invoice.raw_payload as Record<string, unknown>)
            : {},
        userId: user.id,
      },
      fetchResult.enrichment,
    );

    if (enrichmentResult.status === 'not_available') {
      throw new Error(fetchResult.message ?? 'Nao foi possivel extrair dados automaticamente deste portal.');
    }

    if (enrichmentResult.error) {
      throw new Error(enrichmentResult.error);
    }

    redirectUrl = `/dashboard?latestInvoice=${encodeURIComponent(invoice.id)}&pairingMessage=${encodeURIComponent(
      `Dados extraidos com ${enrichmentResult.itemCount} item(ns).`,
    )}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel extrair os dados da nota.';
    redirectUrl = getDashboardErrorUrl(message);
  }

  redirect(redirectUrl);
}

export async function addInvoiceItem(formData: FormData) {
  let redirectUrl = getDashboardMessageUrl('Item adicionado.');

  try {
    const invoiceId = requireText(formData.get('invoiceId'), 'Nota');
    const { supabase, user } = await ensureOwnInvoice(invoiceId);
    const name = requireText(formData.get('name'), 'Item');

    const { error } = await supabase.from('invoice_items').insert({
      invoice_id: invoiceId,
      name,
      quantity: parseOptionalDecimal(formData.get('quantity')),
      raw_payload: { source: 'manual' },
      total_price: parseOptionalDecimal(formData.get('totalPrice')),
      unit_price: parseOptionalDecimal(formData.get('unitPrice')),
      user_id: user.id,
    });

    if (error) {
      throw error;
    }

    redirectUrl = getDashboardMessageUrl('Item adicionado.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel adicionar o item.';
    redirectUrl = getDashboardErrorUrl(message);
  }

  redirect(redirectUrl);
}

export async function deleteInvoiceItem(formData: FormData) {
  let redirectUrl = getDashboardMessageUrl('Item removido.');

  try {
    const itemId = requireText(formData.get('itemId'), 'Item');
    const { supabase, user } = await getAuthenticatedSupabase();

    const { error } = await supabase
      .from('invoice_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    redirectUrl = getDashboardMessageUrl('Item removido.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nao foi possivel remover o item.';
    redirectUrl = getDashboardErrorUrl(message);
  }

  redirect(redirectUrl);
}
