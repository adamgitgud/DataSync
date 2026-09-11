import type { CanonicalClient } from '../../clients/schemas/canonical-client.schema';
import { describe, expect, it, vi } from 'vitest';
import { buildCosperRequest } from './cosper.adapter';
import { canonicalClientSchema } from '../../clients/schemas/canonical-client.schema';
import { cosperRequestSchema } from './cosper.schema';
import { InvalidBuildResultError } from '../../common/errors/domain.error';
import { InputValidationError } from '../../common/validation/input-validation';
import { address, contact, minimalClient } from '../../testing/factories';

describe('Cosper request builder', () => {
  it('builds the complete Acorn-derived request with every key', () => {
    const client = minimalClient({
      id: '90210',
      first_name: 'Priya',
      last_name: 'Chandra-Bose',
      date_of_birth: '1985-07-02',
      legal_sex: 'female',
      marital_status: 'cohabiting',
      addresses: [
        address({
          primary: true,
          line1: 'Flat 4',
          line2: '12 Vereker Road',
          town_city: 'London',
          postcode: 'W14 9JR',
          country: 'GB',
        }),
      ],
      contact_details: [
        contact('email', 'priya.cb@example.co.uk', true),
        contact('mobile', '+447700900123', true),
      ],
    });

    const result = buildCosperRequest(client);

    expect(result).toEqual({
      response: { simulated: true, status: 'created', clientRef: '90210' },
      request: {
        ClientRef: '90210',
        Forename: 'Priya',
        Surname: 'Chandra-Bose',
        DateOfBirth: '02/07/1985',
        Sex: 1,
        MaritalStatus: 3,
        AddressLine1: 'Flat 4',
        AddressLine2: '12 Vereker Road',
        Town: 'London',
        Postcode: 'W14 9JR',
        Country: 'United Kingdom',
        Email: 'priya.cb@example.co.uk',
        Telephone: '+44 7700 900123',
      },
      warnings: [],
    });
    expect(Object.keys(result.request)).toHaveLength(13);
    expect(canonicalClientSchema.parse(client)).toEqual(client);
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
        minimalClient({ marital_status: 'engaged', legal_sex: null }),
      ).warnings,
    ).toEqual([
      {
        code: 'MARITAL_STATUS_UNREPRESENTABLE',
        path: ['marital_status'],
        message: 'Cosper has no engaged status; encoded as 0',
      },
      {
        code: 'LEGAL_SEX_DEFAULTED',
        path: ['legal_sex'],
        message: 'Legal sex is absent; encoded as Cosper code 2',
      },
    ]);
    expect(
      buildCosperRequest(
        minimalClient({ marital_status: 'unknown', legal_sex: 'other' }),
      ).warnings,
    ).toEqual([
      {
        code: 'MARITAL_STATUS_UNKNOWN',
        path: ['marital_status'],
        message: 'Marital status is unknown; encoded as Cosper code 0',
      },
    ]);
    expect(
      buildCosperRequest(
        minimalClient({ marital_status: 'single', legal_sex: 'other' }),
      ).warnings,
    ).toEqual([]);
  });

  it('uses primary address/email and stable phone selection, with nulls for missing data', () => {
    const result = buildCosperRequest(
      minimalClient({
        addresses: [
          address({ line1: 'first' }),
          address({ primary: true, line1: 'primary', country: 'IE' }),
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
      ClientRef: defaultClient.id,
      Forename: null,
      Surname: null,
      DateOfBirth: null,
      Sex: 2,
      MaritalStatus: 0,
      AddressLine1: null,
      AddressLine2: null,
      Town: null,
      Postcode: null,
      Country: null,
      Email: null,
      Telephone: null,
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

  it('does not mutate input and validates the complete canonical boundary', () => {
    const client = minimalClient({
      addresses: [address({ country: 'FR' })],
      contact_details: [contact('email', 'x@y.test')],
    });

    const before = structuredClone(client);

    buildCosperRequest(client);
    expect(client).toEqual(before);
    expect(() => {
      const canonicalInput: CanonicalClient = { ...client, id: '' };

      return buildCosperRequest(canonicalInput);
    }).toThrow();
    expect(() => {
      const extendedClient: CanonicalClient & Record<'extra', boolean> = {
        ...client,
        extra: true,
      };

      return buildCosperRequest(extendedClient);
    }).not.toThrow();
  });

  it('maps internal request validation failures to build-result errors', () => {
    const spy = vi
      .spyOn(cosperRequestSchema, 'parse')
      .mockImplementationOnce(() => {
        throw new InputValidationError([{ path: ['Sex'], message: 'Invalid' }]);
      });

    try {
      expect(() => buildCosperRequest(minimalClient())).toThrow(
        InvalidBuildResultError,
      );
    } finally {
      spy.mockRestore();
    }
  });
});
