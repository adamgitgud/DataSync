import type { CanonicalClient } from '../../clients/schemas/canonical-client.schema';
import { describe, expect, it } from 'vitest';
import { buildCosperRequest } from './cosper.adapter';
import { canonicalClientSchema } from '../../clients/schemas/canonical-client.schema';
import { cosperRequestSchema } from './cosper.schema';
import { address, contact, minimalClient } from '../../testing/factories';

describe('Cosper request builder', () => {
  it('builds the complete Acorn-derived request with every key', () => {
    const client = minimalClient({
      addresses: [
        address({
          country: 'GB',
          line1: 'Flat 4',
          line2: '12 Vereker Road',
          postcode: 'W14 9JR',
          primary: true,
          town_city: 'London',
        }),
      ],
      contact_details: [
        contact('email', 'priya.cb@example.co.uk', true),
        contact('mobile', '+447700900123', true),
      ],
      date_of_birth: '1985-07-02',
      first_name: 'Priya',
      id: '90210',
      last_name: 'Chandra-Bose',
      legal_sex: 'female',
      marital_status: 'cohabiting',
    });

    const result = buildCosperRequest(client);

    expect(result).toEqual({
      request: {
        AddressLine1: 'Flat 4',
        AddressLine2: '12 Vereker Road',
        ClientRef: '90210',
        Country: 'United Kingdom',
        DateOfBirth: '02/07/1985',
        Email: 'priya.cb@example.co.uk',
        Forename: 'Priya',
        MaritalStatus: 3,
        Postcode: 'W14 9JR',
        Sex: 1,
        Surname: 'Chandra-Bose',
        Telephone: '+44 7700 900123',
        Town: 'London',
      },
      response: { clientRef: '90210', simulated: true, status: 'created' },
      warnings: [],
    });
    expect(Object.keys(result.request)).toHaveLength(13);
    expect(canonicalClientSchema.parse(client)).toEqual(client);
    expect(cosperRequestSchema.parse(result.request)).toEqual(result.request);
  });

  it.each([
    ['male', 0],
    ['female', 1],
    ['other', 2],
    ['unspecified', 2],
    [null, 2],
  ] as const)('maps legal sex %j to %j', (sex, code) => {
    const result = buildCosperRequest(
      minimalClient({ legal_sex: sex }),
    ).request;

    expect(result.Sex).toBe(code);
  });

  it.each([
    ['single', 1],
    ['married', 2],
    ['cohabiting', 3],
    ['civil-partner', 4],
    ['engaged', 0],
    ['separated', 5],
    ['divorced', 6],
    ['widowed', 7],
    ['unknown', 0],
  ] as const)('maps marital status %s to %j', (status, code) => {
    const result = buildCosperRequest(
      minimalClient({ marital_status: status }),
    ).request;

    expect(result.MaritalStatus).toBe(code);
  });

  it('returns warnings for engaged, unknown and null sex', () => {
    expect(
      buildCosperRequest(
        minimalClient({ legal_sex: null, marital_status: 'engaged' }),
      ).warnings,
    ).toEqual([
      {
        code: 'MARITAL_STATUS_UNREPRESENTABLE',
        message: 'Cosper has no engaged status; encoded as 0',
        path: ['marital_status'],
      },
      {
        code: 'LEGAL_SEX_DEFAULTED',
        message: 'Legal sex is absent; encoded as Cosper code 2',
        path: ['legal_sex'],
      },
    ]);
    expect(
      buildCosperRequest(
        minimalClient({ legal_sex: 'other', marital_status: 'unknown' }),
      ).warnings,
    ).toEqual([
      {
        code: 'MARITAL_STATUS_UNKNOWN',
        message: 'Marital status is unknown; encoded as Cosper code 0',
        path: ['marital_status'],
      },
    ]);
    expect(
      buildCosperRequest(
        minimalClient({ legal_sex: 'other', marital_status: 'single' }),
      ).warnings,
    ).toEqual([]);
  });

  it('uses primary address/email and stable phone selection, with nulls for missing data', () => {
    const result = buildCosperRequest(
      minimalClient({
        addresses: [
          address({ line1: 'first' }),
          address({ country: 'IE', line1: 'primary', primary: true }),
        ],
        contact_details: [
          contact('mobile', 'mobile'),
          contact('telephone', 'landline', true),
          contact('email', 'first@example.org'),
          contact('email', 'primary@example.org', true),
        ],
      }),
    ).request;

    expect(result).toMatchObject({
      AddressLine1: 'primary',
      Country: 'Ireland',
      Email: 'primary@example.org',
      Telephone: 'landline',
    });
    const defaultClient = minimalClient();

    expect(buildCosperRequest(defaultClient).request).toEqual({
      AddressLine1: null,
      AddressLine2: null,
      ClientRef: defaultClient.id,
      Country: null,
      DateOfBirth: null,
      Email: null,
      Forename: null,
      MaritalStatus: 0,
      Postcode: null,
      Sex: 2,
      Surname: null,
      Telephone: null,
      Town: null,
    });
  });

  it('considers primary landline before non-primary mobile and does not use other contacts', () => {
    const contacts = [
      contact('mobile', 'mobile'),
      contact('telephone', 'landline', true),
      contact('other', 'other', true),
    ];

    expect(
      buildCosperRequest(minimalClient({ contact_details: contacts })).request
        .Telephone,
    ).toBe('landline');
    expect(
      buildCosperRequest(
        minimalClient({ contact_details: [contact('other', 'other')] }),
      ).request.Telephone,
    ).toBeNull();
  });

  it('does not mutate input; edge schema owns the canonical boundary', () => {
    const client = minimalClient({
      addresses: [address({ country: 'FR' })],
      contact_details: [contact('email', 'x@y.test')],
    });

    const before = structuredClone(client);

    buildCosperRequest(client);
    expect(client).toEqual(before);
    expect(() => {
      const canonicalInput: CanonicalClient = { ...client, id: '' };

      return canonicalClientSchema.parse(canonicalInput);
    }).toThrow();
    expect(() => {
      const extendedClient: CanonicalClient & Record<'extra', boolean> = {
        ...client,
        extra: true,
      };

      return buildCosperRequest(extendedClient);
    }).not.toThrow();
  });
});
