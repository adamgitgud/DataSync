import { throwInvariant } from '../errors/invariant';
import { cleanText } from './text';

export function compactPhone(value: string): string {
  return value.replace(/[\s()./-]/g, '');
}

export function normalisePhone(
  value: string | null | undefined,
): string | null {
  const cleaned = cleanText(value);

  if (cleaned === null) {
    return null;
  }

  const compact = compactPhone(cleaned);

  if (/^0\d{10}$/.test(compact)) {
    return `+44${compact.slice(1)}`;
  }

  if (/^0044\d{10}$/.test(compact)) {
    return `+44${compact.slice(4)}`;
  }

  if (/^\+\d{8,15}$/.test(compact)) {
    return compact;
  }

  return cleaned;
}

export function formatCosperPhone(
  value: string | null | undefined,
): string | null {
  const cleaned = cleanText(value);

  if (cleaned === null) {
    return null;
  }

  const match = /^\+44(\d{4})(\d{6})$/.exec(compactPhone(cleaned));

  if (match) {
    return `+44 ${match[1] ?? throwInvariant('Missing phone area capture')} ${match[2] ?? throwInvariant('Missing phone number capture')}`;
  }

  return cleaned;
}
