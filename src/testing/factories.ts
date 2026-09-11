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
    primary: false,
    line1: null,
    line2: null,
    town_city: null,
    county: null,
    postcode: null,
    country: null,
    move_in_date: null,
    ...overrides,
  };
}

export function contact(
  type: CanonicalContactDetail['type'],
  value: string,
  primary = false,
): CanonicalContactDetail {
  return { type, value, primary };
}
