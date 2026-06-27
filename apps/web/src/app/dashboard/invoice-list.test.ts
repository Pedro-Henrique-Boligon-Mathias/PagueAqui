import { describe, expect, it } from 'vitest';

import {
  getInvoiceDisplayDate,
  getInvoiceDisplayTitle,
  getInvoiceDisplayTotal,
  getInvoiceStatus,
  type InvoiceListItem,
} from './invoice-list';

const invoice: InvoiceListItem = {
  access_key: '43260618052247000460650130000545801039901006',
  created_at: '2026-06-27T12:00:00.000Z',
  id: '6a1c5a4e-4454-47b0-9332-9a04983b5a44',
  issuer_name: null,
  purchased_at: null,
  qr_url: 'https://example.com/nfce',
  total_amount: null,
};

describe('invoice list helpers', () => {
  it('uses purchase date before creation date', () => {
    expect(getInvoiceDisplayDate({ ...invoice, purchased_at: '2026-06-26T12:00:00.000Z' })).toBe(
      '2026-06-26T12:00:00.000Z',
    );
  });

  it('formats known totals', () => {
    expect(getInvoiceDisplayTotal({ ...invoice, total_amount: '12.5' })).toBe('R$ 12,50');
  });

  it('shows pending totals when extraction has not filled the amount yet', () => {
    expect(getInvoiceDisplayTotal(invoice)).toBe('Valor pendente');
  });

  it('uses issuer name when present and access key suffix otherwise', () => {
    expect(getInvoiceDisplayTitle({ ...invoice, issuer_name: 'Mercado Teste' })).toBe('Mercado Teste');
    expect(getInvoiceDisplayTitle(invoice)).toBe('NFC-e 39901006');
  });

  it('marks partially extracted invoices as basic data', () => {
    expect(getInvoiceStatus(invoice)).toBe('Dados basicos salvos');
  });
});
