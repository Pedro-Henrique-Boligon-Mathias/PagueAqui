import { describe, expect, it } from 'vitest';

import {
  getDashboardErrorUrl,
  getDashboardMessageUrl,
  normalizeOptionalText,
  parseOptionalDateTime,
  parseOptionalDecimal,
  requireText,
} from './manual-entry';

describe('manual invoice entry helpers', () => {
  it('normalizes optional text values', () => {
    expect(normalizeOptionalText(' Mercado Teste ')).toBe('Mercado Teste');
    expect(normalizeOptionalText('   ')).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
  });

  it('parses decimal values with dot or comma', () => {
    expect(parseOptionalDecimal('12.5')).toBe(12.5);
    expect(parseOptionalDecimal('12,5')).toBe(12.5);
    expect(parseOptionalDecimal('')).toBeNull();
  });

  it('rejects invalid decimal values', () => {
    expect(() => parseOptionalDecimal('-1')).toThrow('numero valido');
    expect(() => parseOptionalDecimal('abc')).toThrow('numero valido');
  });

  it('parses datetime-local values to ISO strings', () => {
    expect(parseOptionalDateTime('2026-06-27T15:30')).toBe('2026-06-27T18:30:00.000Z');
    expect(parseOptionalDateTime('')).toBeNull();
  });

  it('requires text for mandatory fields', () => {
    expect(requireText(' Arroz ', 'Item')).toBe('Arroz');
    expect(() => requireText('', 'Item')).toThrow('Item e obrigatorio.');
  });

  it('builds dashboard redirect urls', () => {
    expect(getDashboardMessageUrl('Nota atualizada.')).toBe('/dashboard?pairingMessage=Nota%20atualizada.');
    expect(getDashboardErrorUrl('Erro aqui')).toBe('/dashboard?pairingError=Erro%20aqui');
  });
});
