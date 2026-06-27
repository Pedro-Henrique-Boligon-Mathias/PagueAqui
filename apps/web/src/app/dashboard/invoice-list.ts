export type InvoiceListItem = {
  access_key: string | null;
  created_at: string;
  id: string;
  issuer_name: string | null;
  purchased_at: string | null;
  qr_url: string;
  total_amount: number | string | null;
};

export function getInvoiceDisplayDate(invoice: InvoiceListItem) {
  return invoice.purchased_at ?? invoice.created_at;
}

export function getInvoiceDisplayTotal(invoice: InvoiceListItem) {
  if (invoice.total_amount === null) {
    return 'Valor pendente';
  }

  const amount = typeof invoice.total_amount === 'string' ? Number(invoice.total_amount) : invoice.total_amount;

  if (!Number.isFinite(amount)) {
    return 'Valor pendente';
  }

  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  }).format(amount);
}

export function getInvoiceDisplayTitle(invoice: InvoiceListItem) {
  return invoice.issuer_name ?? `NFC-e ${invoice.access_key?.slice(-8) ?? invoice.id.slice(0, 8)}`;
}

export function getInvoiceStatus(invoice: InvoiceListItem) {
  return invoice.total_amount === null || invoice.issuer_name === null ? 'Dados basicos salvos' : 'Completa';
}
