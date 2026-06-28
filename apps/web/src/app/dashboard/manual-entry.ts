export function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseOptionalDecimal(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const amount = Number(normalized.replace(',', '.'));

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Informe um numero valido maior ou igual a zero.');
  }

  return amount;
}

export function parseOptionalDateTime(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Informe uma data valida.');
  }

  return date.toISOString();
}

export function requireText(value: FormDataEntryValue | null, fieldName: string) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    throw new Error(`${fieldName} e obrigatorio.`);
  }

  return normalized;
}

export function getDashboardMessageUrl(message: string) {
  return `/dashboard?pairingMessage=${encodeURIComponent(message)}`;
}

export function getDashboardErrorUrl(message: string) {
  return `/dashboard?pairingError=${encodeURIComponent(message)}`;
}
