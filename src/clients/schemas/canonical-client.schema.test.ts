import type { WithAdditionalFields } from '../../testing/payloads';
import type { CanonicalClient } from './canonical-client.schema';
import { describe, expect, it } from 'vitest';
import { canonicalClientSchema } from './canonical-client.schema';
import { address, contact, minimalClient } from '../../testing/factories';

type ChangedClient<TChanges> = {
  [Key in keyof CanonicalClient]:
    CanonicalClient[Key] | (Key extends keyof TChanges ? TChanges[Key] : never);
};

describe('canonical boundary', () => {
  it('accepts the complete minimal contract and the supplied NI allocation', () => {
    expect(canonicalClientSchema.parse(minimalClient())).toEqual(
      minimalClient(),
    );
    expect(
      canonicalClientSchema.parse(minimalClient({ ni_number: 'QQ123456C' }))
        .ni_number,
    ).toBe('QQ123456C');
  });

  it.each(Object.keys(minimalClient()))(
    'requires the %s key, including nullable keys',
    (key) => {
      const input: Record<string, unknown> = { ...minimalClient() };

      delete input[key];
      expect(canonicalClientSchema.safeParse(input).success).toBe(false);
    },
  );

  it.each([
    { id: '' },
    { id: '   ' },
    { id: 12 },
    { id: ` ${minimalClient().id} ` },
    { first_name: 42 },
    { title: '' },
    { nationality: '   ' },
    { date_of_birth: '29/02/2024' },
    { date_of_birth: '2023-02-29' },
    { date_of_birth: '1985-04-31' },
    { date_of_birth: '2024-02-29T00:00:00Z' },
    { legal_sex: 'Female' },
    { marital_status: null },
    { marital_status: 'invalid' },
    { ni_number: 'qq123456c' },
    { ni_number: 'QQ 123456C' },
    { addresses: null },
    { addresses: {} },
    { addresses: [null] },
    { addresses: [{}] },
    {
      addresses: [address({ country: 'GB' }), { ...address(), country: 'GBR' }],
    },
    { addresses: [{ ...address(), country: 'ZZ' }] },
    { addresses: [{ ...address(), country: 'gb' }] },
    { addresses: [address({ move_in_date: '2023-02-29' })] },
    { addresses: [address({ postcode: 'w14 9jr' })] },
    { contact_details: null },
    { contact_details: [{}] },
    { contact_details: [contact('email', '  ')] },
    { contact_details: [{ type: 'fax', value: '123', primary: false }] },
    {
      contact_details: [
        { type: 'email', value: 'a@example.org', primary: 'true' },
      ],
    },
  ])('rejects malformed or unnormalised canonical data: %j', (changes) => {
    const changedClient: ChangedClient<typeof changes> = {
      ...minimalClient(),
      ...changes,
    };

    expect(canonicalClientSchema.safeParse(changedClient).success).toBe(false);
  });

  it('accepts real leap dates and supported country codes', () => {
    const input = minimalClient({
      date_of_birth: '2024-02-29',
      addresses: [address({ country: 'GB' })],
    });

    expect(canonicalClientSchema.parse(input)).toEqual(input);
  });

  it('strips unknown keys recursively without changing the caller object', () => {
    const input: WithAdditionalFields<CanonicalClient> = {
      ...minimalClient(),
      extra: 1,
      addresses: [{ ...address(), extra: 'address' }],
      contact_details: [
        { ...contact('email', 'person@example.org'), extra: 'contact' },
      ],
    };

    const before = structuredClone(input);

    expect(canonicalClientSchema.parse(input)).toEqual(
      minimalClient({
        addresses: [address()],
        contact_details: [contact('email', 'person@example.org')],
      }),
    );
    expect(input).toEqual(before);
  });
});
