import type { CanonicalContactDetail } from '../../clients/schemas/canonical-client.schema';
import { normalisePhone } from './phones';
import { cleanText } from './text';

export function toCanonicalContact(
  type: CanonicalContactDetail['type'],
  rawValue: string | null | undefined,
  primary: boolean,
): CanonicalContactDetail | undefined {
  const cleaned = cleanText(rawValue);

  if (cleaned === null) {
    return undefined;
  }

  return {
    type,
    value:
      type === 'mobile' || type === 'telephone'
        ? (normalisePhone(cleaned) ?? cleaned)
        : cleaned,
    primary,
  };
}

export function mapContacts<TPoint>(
  points: readonly TPoint[],
  resolve: (point: TPoint) => CanonicalContactDetail | undefined,
): CanonicalContactDetail[] {
  const contacts: CanonicalContactDetail[] = [];

  for (const point of points) {
    const contact = resolve(point);

    if (contact !== undefined) {
      contacts.push(contact);
    }
  }

  return contacts;
}
