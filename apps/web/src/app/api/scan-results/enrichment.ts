import type { SupabaseClient } from '@supabase/supabase-js';

const allowedInvoiceHosts = new Set(['dfe-portal.svrs.rs.gov.br', 'www.sefaz.rs.gov.br', 'sefaz.rs.gov.br']);

export type EnrichedInvoiceItem = {
  code: string | null;
  name: string;
  quantity: number | null;
  totalPrice: number | null;
  unit: string | null;
  unitPrice: number | null;
};

export type EnrichedInvoice = {
  issuerName: string | null;
  items: EnrichedInvoiceItem[];
  purchasedAt: string | null;
  totalAmount: number | null;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function getFirstMatch(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1] ? stripTags(match[1]) : null;
}

function parseBrazilianNumber(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function parseBrazilianDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) {
    return null;
  }

  const [, day, month, year, hour, minute, second = '00'] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function parseItemRow(rowHtml: string): EnrichedInvoiceItem | null {
  const name = getFirstMatch(rowHtml, /<span[^>]*class=["'][^"']*txtTit[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

  if (!name) {
    return null;
  }

  const code = getFirstMatch(rowHtml, /<span[^>]*class=["'][^"']*RCod[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.match(
    /Código:\s*([^)]*)/i,
  )?.[1]?.trim() ?? null;
  const quantityText = getFirstMatch(rowHtml, /<span[^>]*class=["'][^"']*Rqtd[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const unitText = getFirstMatch(rowHtml, /<span[^>]*class=["'][^"']*RUN[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const unitPriceText = getFirstMatch(rowHtml, /<span[^>]*class=["'][^"']*RvlUnit[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const totalText = getFirstMatch(rowHtml, /<span[^>]*class=["'][^"']*valor[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

  return {
    code,
    name,
    quantity: parseBrazilianNumber(quantityText?.replace(/Qtde\.:/i, '') ?? null),
    totalPrice: parseBrazilianNumber(totalText),
    unit: unitText?.replace(/UN:\s*/i, '').trim() || null,
    unitPrice: parseBrazilianNumber(unitPriceText?.replace(/Vl\. Unit\.:/i, '') ?? null),
  };
}

export function parseSvrsNfceHtml(html: string): EnrichedInvoice | null {
  const issuerName = getFirstMatch(html, /<div[^>]*id=["']u20["'][^>]*>([\s\S]*?)<\/div>/i);
  const totalAmount = parseBrazilianNumber(
    getFirstMatch(
      html,
      /<label>\s*Valor\s+a\s+pagar\s+R\$:\s*<\/label>\s*<span[^>]*>([\s\S]*?)<\/span>/i,
    ),
  );
  const purchasedAt = parseBrazilianDateTime(
    getFirstMatch(html, /<strong>\s*Número:[\s\S]*?<strong>\s*Emissão:\s*<\/strong>([\s\S]*?)<br/i),
  );
  const items: EnrichedInvoiceItem[] = [];
  const itemRows = html.matchAll(/<tr[^>]*id=["']Item\s*\+\s*\d+["'][^>]*>([\s\S]*?)<\/tr>/gi);

  for (const [, rowHtml] of itemRows) {
    if (!rowHtml) {
      continue;
    }

    const item = parseItemRow(rowHtml);

    if (item) {
      items.push(item);
    }
  }

  if (!issuerName && totalAmount === null && !purchasedAt && items.length === 0) {
    return null;
  }

  return {
    issuerName,
    items,
    purchasedAt,
    totalAmount,
  };
}

export type InvoiceEnrichmentFetchResult = {
  enrichment: EnrichedInvoice | null;
  message: string | null;
  reason:
    | 'fetch_failed'
    | 'http_error'
    | 'invalid_url'
    | 'non_html_response'
    | 'parser_no_match'
    | 'success'
    | 'unsupported_host';
};

export function canFetchInvoiceUrl(qrUrl: string) {
  return getInvoiceUrlSupport(qrUrl).supported;
}

export function getInvoiceUrlSupport(qrUrl: string) {
  try {
    const url = new URL(qrUrl);

    if (url.protocol !== 'https:') {
      return {
        host: url.hostname,
        message: `O link da NFC-e usa ${url.protocol}. Por seguranca, so busco URLs HTTPS.`,
        supported: false,
      };
    }

    if (!allowedInvoiceHosts.has(url.hostname)) {
      return {
        host: url.hostname,
        message: `Portal ainda nao suportado para extracao automatica: ${url.hostname}.`,
        supported: false,
      };
    }

    return {
      host: url.hostname,
      message: null,
      supported: true,
    };
  } catch {
    return {
      host: null,
      message: 'Link da NFC-e invalido.',
      supported: false,
    };
  }
}

export async function fetchInvoiceEnrichmentDetailed(qrUrl: string, timeoutMs = 8_000): Promise<InvoiceEnrichmentFetchResult> {
  const support = getInvoiceUrlSupport(qrUrl);

  if (!support.supported) {
    return {
      enrichment: null,
      message: support.message,
      reason: support.host ? 'unsupported_host' : 'invalid_url',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(qrUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 LeitorNFCe/0.1',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        enrichment: null,
        message: `Portal respondeu HTTP ${response.status}.`,
        reason: 'http_error',
      };
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType && !contentType.includes('text/html')) {
      return {
        enrichment: null,
        message: `Portal retornou ${contentType}, nao HTML.`,
        reason: 'non_html_response',
      };
    }

    const html = await response.text();
    const enrichment = parseSvrsNfceHtml(html);

    if (!enrichment) {
      const bodyHint = stripTags(html).slice(0, 160);
      return {
        enrichment: null,
        message: bodyHint
          ? `Nao encontrei os campos esperados no HTML do portal. Inicio da resposta: ${bodyHint}`
          : 'Nao encontrei os campos esperados no HTML do portal.',
        reason: 'parser_no_match',
      };
    }

    return {
      enrichment,
      message: null,
      reason: 'success',
    };
  } catch (error) {
    return {
      enrichment: null,
      message: error instanceof Error ? error.message : 'Falha ao buscar o portal da NFC-e.',
      reason: 'fetch_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchInvoiceEnrichment(qrUrl: string, timeoutMs = 8_000) {
  const result = await fetchInvoiceEnrichmentDetailed(qrUrl, timeoutMs);
  return result.enrichment;
}


export type ApplyInvoiceEnrichmentResult = {
  error: string | null;
  itemCount: number;
  status: 'completed' | 'invoice_update_failed' | 'items_insert_failed' | 'not_available';
};

async function runQuery(value: unknown) {
  return (await value) as { error: { message: string } | null };
}

export async function applyInvoiceEnrichment(
  supabase: SupabaseClient,
  invoice: { id: string; rawPayload: Record<string, unknown>; userId: string },
  enrichment: EnrichedInvoice | null,
): Promise<ApplyInvoiceEnrichmentResult> {
  if (!enrichment) {
    return {
      error: null,
      itemCount: 0,
      status: 'not_available',
    };
  }

  const updateResult = await runQuery(
    supabase
      .from('invoices')
      .update({
        issuer_name: enrichment.issuerName,
        purchased_at: enrichment.purchasedAt,
        raw_payload: {
          ...invoice.rawPayload,
          enrichment: {
            itemCount: enrichment.items.length,
            source: 'svrs_qrcode_html',
            status: 'completed',
          },
        },
        total_amount: enrichment.totalAmount,
      })
      .eq('id', invoice.id)
      .eq('user_id', invoice.userId),
  );

  if (updateResult.error) {
    return {
      error: updateResult.error.message,
      itemCount: enrichment.items.length,
      status: 'invoice_update_failed',
    };
  }

  await runQuery(
    supabase
      .from('invoice_items')
      .delete()
      .eq('invoice_id', invoice.id)
      .eq('user_id', invoice.userId)
      .eq('raw_payload->>source', 'svrs_qrcode_html'),
  );

  if (!enrichment.items.length) {
    return {
      error: null,
      itemCount: 0,
      status: 'completed',
    };
  }

  const insertResult = await supabase.from('invoice_items').insert(
    enrichment.items.map((item) => ({
      invoice_id: invoice.id,
      name: item.name,
      quantity: item.quantity,
      raw_payload: {
        code: item.code,
        source: 'svrs_qrcode_html',
        unit: item.unit,
      },
      total_price: item.totalPrice,
      unit_price: item.unitPrice,
      user_id: invoice.userId,
    })),
  );

  if (insertResult.error) {
    return {
      error: insertResult.error.message,
      itemCount: enrichment.items.length,
      status: 'items_insert_failed',
    };
  }

  return {
    error: null,
    itemCount: enrichment.items.length,
    status: 'completed',
  };
}
