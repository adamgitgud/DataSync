import type {
  MalformedAcornPayload,
  WithAdditionalFields,
  AcornPayload,
} from '../../testing/payloads';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalClientSchema } from '../../clients/schemas/canonical-client.schema';
import { normaliseAcorn as normaliseValidatedAcorn } from './acorn.adapter';
import { acornClientSchema, type AcornClient } from './acorn.schema';
import { InputValidationError } from '../../common/validation/input-validation';
import { address, minimalClient } from '../../testing/factories';

function validateAcorn(input: unknown): AcornClient {
  return acornClientSchema.parse(input);
}

function normalisePayload(input: unknown) {
  return normaliseValidatedAcorn(validateAcorn(input));
}

const fixture: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/acorn-client.json', import.meta.url),
    'utf8',
  ),
);

function expectInvalid(input: unknown, path: (string | number)[]) {
  expect(() => validateAcorn(input)).toThrow(InputValidationError);

  try {
    validateAcorn(input);
  } catch (error) {
    if (!(error instanceof InputValidationError)) {
      throw error;
    }

    expect(error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  }
}

describe('Acorn fixture', () => {
  it('maps every field literally, retaining its extra email and move-in date', () => {
    const before = structuredClone(fixture);

    const result = normalisePayload(fixture);

    expect(result).toEqual({
      addresses: [
        {
          country: 'GB',
          county: 'Greater London',
          line1: 'Flat 4',
          line2: '12 Vereker Road',
          move_in_date: '2016-03-01',
          postcode: 'W14 9JR',
          primary: true,
          town_city: 'London',
        },
      ],
      contact_details: [
        { primary: true, type: 'email', value: 'priya.cb@example.co.uk' },
        { primary: true, type: 'mobile', value: '+447700900123' },
        { primary: false, type: 'email', value: 'priya@oldmail.example' },
      ],
      date_of_birth: '1985-07-02',
      first_name: 'Priya',
      full_name: 'Priya Chandra-Bose',
      id: '90210',
      last_name: 'Chandra-Bose',
      legal_sex: 'female',
      marital_status: 'cohabiting',
      middle_names: null,
      nationality: 'United Kingdom',
      ni_number: 'QQ123456C',
      title: 'Mrs',
    });
    expect(canonicalClientSchema.parse(result)).toEqual(result);
    expect(fixture).toEqual(before);
  });
});

describe('Acorn enum mappings', () => {
  it.each([
    ['Male', 'male'],
    ['Female', 'female'],
    ['Unspecified', 'unspecified'],
    ['Non-Binary', null],
    ['unrecognized', null],
    ['constructor', null],
    ['Unknown', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('maps gender %j to %j', (gender, expected) => {
    const acornInput: AcornPayload = { id: 1, person: { gender } };

    expect(normalisePayload(acornInput).legal_sex).toBe(expected);

    if (typeof gender === 'string') {
      const acornInput: AcornPayload = {
        id: 1,
        person: { gender: ` ${gender.toUpperCase()} ` },
      };

      expect(normalisePayload(acornInput).legal_sex).toBe(expected);
    }
  });

  it.each([
    ['Single', 'single'],
    ['Married', 'married'],
    ['Civil Partner', 'civil-partner'],
    ['Living Together', 'cohabiting'],
    ['Engaged', 'engaged'],
    ['Separated', 'separated'],
    ['Divorced', 'divorced'],
    ['Widowed', 'widowed'],
    ['Unknown', 'unknown'],
    ['unrecognized', 'unknown'],
    ['constructor', 'unknown'],
    ['', 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown'],
  ])('maps marital status %j to %j', (maritalStatus, expected) => {
    const acornInput: AcornPayload = {
      id: 1,
      person: { maritalStatus },
    };

    expect(normalisePayload(acornInput).marital_status).toBe(expected);

    if (typeof maritalStatus === 'string') {
      const acornInput: AcornPayload = {
        id: 1,
        person: { maritalStatus: ` ${maritalStatus.toUpperCase()} ` },
      };

      expect(normalisePayload(acornInput).marital_status).toBe(expected);
    }
  });

  it.each([
    ['EmailAddress', 'email'],
    ['MobilePhone', 'mobile'],
    ['Landline', 'telephone'],
    ['Fax', 'other'],
    ['constructor', 'other'],
    ['', 'other'],
    [null, 'other'],
    [undefined, 'other'],
  ])(
    'maps channel %j to %j, applying phone normalisation only to phones',
    (channel, expected) => {
      for (const label of [
        channel,
        typeof channel === 'string' ? ` ${channel.toUpperCase()} ` : channel,
      ]) {
        const acornInput: AcornPayload = {
          contactPoints: [{ channel: label, detail: ' 07700 900123 ' }],
          id: 1,
        };

        expect(normalisePayload(acornInput).contact_details).toEqual([
          {
            primary: false,
            type: expected,
            value:
              expected === 'mobile' || expected === 'telephone'
                ? '+447700900123'
                : '07700 900123',
          },
        ]);
      }
    },
  );
});

describe('Acorn absent data and normalisation', () => {
  it.each([undefined, null, {}])(
    'accepts missing/null/empty person %j with valid ID',
    (person) => {
      const acornInput: AcornPayload = { id: 0, person };

      expect(normalisePayload(acornInput)).toEqual(minimalClient({ id: '0' }));
    },
  );

  it.each([0, 90210, Number.MAX_SAFE_INTEGER, ' external-id ', '0'])(
    'preserves valid provider ID %j',
    (id) => {
      const acornInput: AcornPayload = { id };

      expect(normalisePayload(acornInput).id).toBe(String(id).trim());
    },
  );

  it.each([undefined, null, []])(
    'normalises missing/null collections %j to arrays',
    (items) => {
      const expected = minimalClient();
      const acornInput: AcornPayload = {
        addresses: items,
        contactPoints: items,
        id: expected.id,
      };

      expect(normalisePayload(acornInput)).toEqual(expected);
    },
  );

  it('cleans all optional text, names, NI and postcode, preserving free nationality', () => {
    const expected = minimalClient({
      addresses: [
        address({
          country: 'GB',
          county: 'Greater London',
          postcode: 'W14 9JR',
          town_city: 'London',
        }),
      ],
      date_of_birth: '2024-02-29',
      first_name: 'Priya',
      full_name: 'Priya Anne Mary Bose',
      last_name: 'Bose',
      middle_names: 'Anne  Mary',
      nationality: 'Martian',
      ni_number: 'QQ123456C',
      title: 'Dr',
    });
    const acornInput: AcornPayload = {
      addresses: [
        {
          countryName: ' uk ',
          postcode: ' w14 9jr ',
          region: ' Greater London ',
          town: ' London ',
        },
      ],
      id: expected.id,
      person: {
        dateOfBirth: ' 2024-02-29 ',
        firstName: ' Priya ',
        lastName: ' Bose ',
        middleName: ' Anne  Mary ',
        nationalityCountry: { isoCode: 'invalid', name: ' Martian ' },
        niNumber: ' qq 12\t34 56 c ',
        title: ' Dr ',
      },
    };

    expect(normalisePayload(acornInput)).toEqual(expected);
  });

  it('turns blank optional fields into null and retains an empty address', () => {
    const expected = minimalClient({ addresses: [address()] });
    const acornInput: AcornPayload = {
      addresses: [
        {
          buildingName: '',
          countryName: 'Atlantis',
          locality: null,
          movedIn: ' ',
          postcode: '\t',
          region: ' ',
          street: ' ',
          town: '',
        },
      ],
      id: expected.id,
      person: {
        dateOfBirth: ' ',
        firstName: '',
        lastName: '\t',
        middleName: null,
        nationalityCountry: null,
        niNumber: '',
        title: ' ',
      },
    };

    expect(normalisePayload(acornInput)).toEqual(expected);
  });

  it('prefers a recognized nationality code then a recognized/free-text name', () => {
    for (const [isoCode, name, expected] of [
      ['FR', 'Germany', 'France'],
      ['bad', 'GBR', 'United Kingdom'],
      [null, ' British ', 'United Kingdom'],
      ['bad', ' Martian ', 'Martian'],
      ['bad', null, null],
    ]) {
      const acornInput: AcornPayload = {
        id: 1,
        person: { nationalityCountry: { isoCode, name } },
      };

      expect(normalisePayload(acornInput).nationality).toBe(expected);
    }
  });

  it('drops only blank contacts and preserves all usable values and source ordering', () => {
    const acornInput: AcornPayload = {
      contactPoints: [
        {},
        { detail: null },
        { detail: ' \t ' },
        {
          channel: 'MobilePhone',
          detail: ' 07700 900123 ext 4 ',
          preferred: true,
        },
        { channel: 'Fax', detail: ' fax:123 ' },
        {
          channel: 'EmailAddress',
          detail: ' a@example.org ',
          preferred: true,
        },
      ],
      id: 1,
    };

    expect(normalisePayload(acornInput).contact_details).toEqual([
      { primary: true, type: 'mobile', value: '07700 900123 ext 4' },
      { primary: false, type: 'other', value: 'fax:123' },
      { primary: true, type: 'email', value: 'a@example.org' },
    ]);
  });

  it('ignores extra provider keys at each level', () => {
    const expected = minimalClient({
      addresses: [address()],
      contact_details: [{ primary: false, type: 'other', value: 'abc' }],
    });
    const extendedAcornInput: WithAdditionalFields<AcornPayload> = {
      addresses: [{ future: 42, kind: 'Home' }],
      contactPoints: [{ detail: 'abc', future: [] }],
      future: {},
      id: expected.id,
      person: { future: 42, nationalityCountry: { future: [] } },
    };

    expect(normalisePayload(extendedAcornInput)).toEqual(expected);
  });
});

describe('Acorn address layout', () => {
  it.each([
    {
      buildingName: 'Flat 4',
      line1: 'Flat 4',
      line2: '12 Road, Village',
      locality: 'Village',
      street: '12 Road',
    },
    {
      buildingName: 'Flat 4',
      line1: 'Flat 4',
      line2: '12 Road',
      locality: null,
      street: '12 Road',
    },
    {
      buildingName: 'Flat 4',
      line1: 'Flat 4',
      line2: 'Village',
      locality: 'Village',
      street: null,
    },
    {
      buildingName: 'Flat 4',
      line1: 'Flat 4',
      line2: null,
      locality: null,
      street: null,
    },
    {
      buildingName: null,
      line1: '12 Road',
      line2: 'Village',
      locality: 'Village',
      street: '12 Road',
    },
    {
      buildingName: null,
      line1: '12 Road',
      line2: null,
      locality: null,
      street: '12 Road',
    },
    {
      buildingName: null,
      line1: 'Village',
      line2: null,
      locality: 'Village',
      street: null,
    },
    {
      buildingName: null,
      line1: null,
      line2: null,
      locality: null,
      street: null,
    },
  ])(
    'lays out building=%j street=%j locality=%j',
    ({ buildingName, line1, line2, locality, street }) => {
      const acornInput: AcornPayload = {
        addresses: [{ buildingName, locality, street }],
        id: 1,
      };

      expect(normalisePayload(acornInput).addresses).toEqual([
        address({ line1: line1 ?? null, line2: line2 ?? null }),
      ]);
    },
  );

  it('cleans components before composing and never reorders primary addresses', () => {
    const acornInput: AcornPayload = {
      addresses: [
        { buildingName: ' ', locality: ' Village ', street: ' Road ' },
        {
          buildingName: ' Building ',
          isPrimary: true,
          locality: ' Village ',
          street: ' Road ',
        },
      ],
      id: 1,
    };

    expect(normalisePayload(acornInput).addresses).toEqual([
      address({ line1: 'Road', line2: 'Village' }),
      address({ line1: 'Building', line2: 'Road, Village', primary: true }),
    ]);
  });
});

describe('Acorn classified caller errors', () => {
  it.each([undefined, null, true, [], 'client'])(
    'rejects invalid root %j',
    (input) => expectInvalid(input, []),
  );

  it.each([
    undefined,
    null,
    '',
    '  ',
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    Infinity,
    NaN,
    true,
    {},
    [],
  ])('rejects invalid ID %j', (id) => {
    const malformedAcornInput: MalformedAcornPayload = { id };

    return expectInvalid(malformedAcornInput, ['id']);
  });

  it.each(['person', 'addresses', 'contactPoints'])(
    'rejects malformed %s',
    (key) => {
      const malformedAcornInput: MalformedAcornPayload = {
        id: 1,
        [key]: 'invalid',
      };

      expectInvalid(malformedAcornInput, [key]);
    },
  );

  it.each(['addresses', 'contactPoints'])(
    'rejects malformed items in %s',
    (key) => {
      for (const item of [null, 42, [], 'text']) {
        const malformedAcornInput: MalformedAcornPayload = {
          id: 1,
          [key]: [item],
        };

        expectInvalid(malformedAcornInput, [key, 0]);
      }
    },
  );

  it.each([
    'title',
    'firstName',
    'middleName',
    'lastName',
    'dateOfBirth',
    'niNumber',
    'gender',
    'maritalStatus',
    'nationalityCountry',
  ])('rejects non-text/structural person.%s', (key) => {
    const malformedAcornInput: MalformedAcornPayload = {
      id: 1,
      person: { [key]: 42 },
    };

    return expectInvalid(malformedAcornInput, ['person', key]);
  });

  it.each(['name', 'isoCode'])('rejects invalid nationality %s', (key) => {
    const malformedAcornInput: MalformedAcornPayload = {
      id: 1,
      person: { nationalityCountry: { [key]: false } },
    };

    expectInvalid(malformedAcornInput, ['person', 'nationalityCountry', key]);
  });

  it.each([
    'buildingName',
    'street',
    'locality',
    'town',
    'region',
    'postcode',
    'countryName',
    'movedIn',
  ])('rejects non-text address %s', (key) => {
    const malformedAcornInput: MalformedAcornPayload = {
      addresses: [{ [key]: 42 }],
      id: 1,
    };

    return expectInvalid(malformedAcornInput, ['addresses', 0, key]);
  });

  it.each(['channel', 'detail'])(
    'rejects non-text contact %s even if detail would be dropped',
    (key) => {
      const malformedAcornInput: MalformedAcornPayload = {
        contactPoints: [{ [key]: 42 }],
        id: 1,
      };

      expectInvalid(malformedAcornInput, ['contactPoints', 0, key]);
    },
  );

  it.each(['true', 'false', 1, 0, null])(
    'rejects nonboolean flags %j',
    (flag) => {
      const malformedAcornInput: MalformedAcornPayload = {
        addresses: [{ isPrimary: flag }],
        id: 1,
      };

      expectInvalid(malformedAcornInput, ['addresses', 0, 'isPrimary']);
      const malformedAcornInput2: MalformedAcornPayload = {
        contactPoints: [{ preferred: flag }],
        id: 1,
      };

      expectInvalid(malformedAcornInput2, ['contactPoints', 0, 'preferred']);
    },
  );

  it.each(['2023-02-29', '1985-04-31', '02/07/1985', '1985-07-02T00:00:00Z'])(
    'rejects impossible or wrong-format date %s at its source path',
    (date) => {
      const acornInput: AcornPayload = { id: 1, person: { dateOfBirth: date } };

      expectInvalid(acornInput, ['person', 'dateOfBirth']);
      const acornInput2: AcornPayload = {
        addresses: [{ movedIn: date }],
        id: 1,
      };

      expectInvalid(acornInput2, ['addresses', 0, 'movedIn']);
    },
  );
});
