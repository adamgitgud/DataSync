import {
  createEmptyCanonicalClient,
  type CanonicalAddress,
  type CanonicalClient,
  type CanonicalContactDetail,
} from '../clients/schemas/canonical-client.schema';

export function minimalClient(
  overrides: Partial<CanonicalClient> = {},
): CanonicalClient {
  return { ...createEmptyCanonicalClient(), ...overrides };
}

export function address(
  overrides: Partial<CanonicalAddress> = {},
): CanonicalAddress {
  return {
    country: null,
    county: null,
    line1: null,
    line2: null,
    move_in_date: null,
    postcode: null,
    primary: false,
    town_city: null,
    ...overrides,
  };
}

export function contact(
  type: CanonicalContactDetail['type'],
  value: string,
  primary = false,
): CanonicalContactDetail {
  return { primary, type, value };
}
