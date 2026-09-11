import type {
  CanonicalAddress,
  CanonicalContactDetail,
} from '../../clients/schemas/canonical-client.schema';

export function selectAddress(
  addresses: readonly CanonicalAddress[],
): CanonicalAddress | undefined {
  return addresses.find((address) => address.primary) ?? addresses[0];
}

export function selectEmail(
  contacts: readonly CanonicalContactDetail[],
): CanonicalContactDetail | undefined {
  return (
    contacts.find((contact) => contact.type === 'email' && contact.primary) ??
    contacts.find((contact) => contact.type === 'email')
  );
}

export function selectPhone(
  contacts: readonly CanonicalContactDetail[],
): CanonicalContactDetail | undefined {
  return (
    contacts.find(
      (contact) =>
        contact.primary &&
        (contact.type === 'mobile' || contact.type === 'telephone'),
    ) ??
    contacts.find((contact) => contact.type === 'mobile') ??
    contacts.find((contact) => contact.type === 'telephone')
  );
}
