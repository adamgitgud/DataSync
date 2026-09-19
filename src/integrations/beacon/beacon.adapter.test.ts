import type {
  MalformedBeaconPayload,
  WithAdditionalFields,
  FixtureValue,
  BeaconPayload,
} from '../../testing/payloads';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalClientSchema } from '../../clients/schemas/canonical-client.schema';
import { normaliseBeacon as normaliseValidatedBeacon } from './beacon.adapter';
import { beaconClientSchema, type BeaconClient } from './beacon.schema';
import { InputValidationError } from '../../common/validation/input-validation';
import { address, minimalClient } from '../../testing/factories';

function validateBeacon(input: unknown): BeaconClient {
  return beaconClientSchema.parse(input);
}

function normalisePayload(input: unknown) {
  return normaliseValidatedBeacon(validateBeacon(input));
}

const fixture: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/beacon-client.json', import.meta.url),
    'utf8',
  ),
);

function invalid(input: unknown, path: (string | number)[]) {
  expect(() => validateBeacon(input)).toThrow(InputValidationError);

  try {
    validateBeacon(input);
  } catch (error) {
    if (!(error instanceof InputValidationError)) {
      throw error;
    }

    expect(error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    );
  }
}

const attributes = [
  'firstname',
  'middlename',
  'lastname',
  'birthdate',
  't4a_ninumber',
  't4a_nationality',
];

const formatted = ['title', 'gendercode', 'familystatuscode'];

describe('Beacon literal fixture', () => {
  it('preserves its ID and address boundaries, normalises all shared data without mutation', () => {
    const before = structuredClone(fixture);

    const result = normalisePayload(fixture);

    expect(result).toEqual({
      addresses: [
        {
          country: 'GB',
          county: 'Greater London',
          line1: 'Flat 4, 12 Vereker Road',
          line2: null,
          move_in_date: null,
          postcode: 'W14 9JR',
          primary: true,
          town_city: 'London',
        },
      ],
      contact_details: [
        { primary: true, type: 'email', value: 'priya.cb@example.co.uk' },
        { primary: true, type: 'mobile', value: '+447700900123' },
      ],
      date_of_birth: '1985-07-02',
      first_name: 'Priya',
      full_name: 'Priya Chandra-Bose',
      id: 'c0ffee7a-1e4b-2c9d-3e00-000000000001',
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

describe('Beacon enums', () => {
  it.each([
    ['Male', 'male'],
    ['Female', 'female'],
    ['Non-Binary', 'other'],
    ['Unspecified', 'unspecified'],
    ['Unknown', null],
    ['constructor', null],
    ['unrecognized', null],
    ['', null],
    [null, null],
    [undefined, null],
  ])('maps gender %j', (value, expected) => {
    for (const label of [
      value,
      typeof value === 'string' ? ` ${value.toUpperCase()} ` : value,
    ]) {
      const beaconInput: BeaconPayload = {
        formattedValues: [{ key: 'gendercode', value: label }],
        recordId: '1',
      };

      expect(normalisePayload(beaconInput).legal_sex).toBe(expected);
    }
  });

  it.each([
    ['Single', 'single'],
    ['Married', 'married'],
    ['Civil Partnership', 'civil-partner'],
    ['Cohabiting', 'cohabiting'],
    ['Intend to Marry', 'engaged'],
    ['Separated', 'separated'],
    ['Divorced', 'divorced'],
    ['Widowed', 'widowed'],
    ['Unknown', 'unknown'],
    ['constructor', 'unknown'],
    ['unrecognized', 'unknown'],
    ['', 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown'],
  ])('maps marital status %j', (value, expected) => {
    for (const label of [
      value,
      typeof value === 'string' ? ` ${value.toUpperCase()} ` : value,
    ]) {
      const beaconInput: BeaconPayload = {
        formattedValues: [{ key: 'familystatuscode', value: label }],
        recordId: '1',
      };

      expect(normalisePayload(beaconInput).marital_status).toBe(expected);
    }
  });

  it.each([
    [1, 'email'],
    [2, 'mobile'],
    [3, 'telephone'],
    [0, 'other'],
    [-1, 'other'],
    [4, 'other'],
    [null, 'other'],
    [undefined, 'other'],
  ])('maps contact type %j', (type, expected) => {
    const beaconInput: BeaconPayload = {
      contacts: [{ type, value: ' 07700 900123 ' }],
      recordId: '1',
    };

    expect(normalisePayload(beaconInput).contact_details).toEqual([
      {
        primary: false,
        type: expected,
        value:
          expected === 'mobile' || expected === 'telephone'
            ? '+447700900123'
            : '07700 900123',
      },
    ]);
  });
});

describe('Beacon bags', () => {
  it.each([undefined, null, []])(
    'accepts absent/null collections %j',
    (items) => {
      const expected = minimalClient();
      const extendedBeaconInput: WithAdditionalFields<
        BeaconPayload<FixtureValue>
      > = {
        addresses: items,
        attributes: items,
        contacts: items,
        formattedValues: items,
        recordId: ` ${expected.id} `,
      };

      expect(normalisePayload(extendedBeaconInput)).toEqual(expected);
    },
  );

  it.each([null, undefined, '', '  ', 'Last'])(
    'uses last duplicate text value %j in each bag',
    (last) => {
      const beaconInput: BeaconPayload = {
        attributes: [
          { key: 'firstname', value: 'First' },
          { key: 'firstname', value: last },
        ],
        formattedValues: [
          { key: 'title', value: 'Dr' },
          { key: 'title', value: last },
        ],
        recordId: '1',
      };

      const result = normalisePayload(beaconInput);

      expect(result.first_name).toBe(last === 'Last' ? 'Last' : null);
      expect(result.title).toBe(last === 'Last' ? 'Last' : null);
    },
  );

  it('applies last-wins to dates and labels too, including null', () => {
    const beaconInput: BeaconPayload = {
      attributes: [
        { key: 'birthdate', value: '29/02/2024' },
        { key: 'birthdate', value: null },
      ],
      formattedValues: [
        { key: 'gendercode', value: 'Male' },
        { key: 'gendercode', value: 'Non-Binary' },
        { key: 'familystatuscode', value: 'Single' },
        { key: 'familystatuscode', value: 'Intend to Marry' },
      ],
      recordId: '1',
    };

    const result = normalisePayload(beaconInput);

    expect(result).toMatchObject({
      date_of_birth: null,
      legal_sex: 'other',
      marital_status: 'engaged',
    });
  });

  it('ignores unknown keys/values and has no fallback across bags', () => {
    const expected = minimalClient();
    const extendedBeaconInput: WithAdditionalFields<
      BeaconPayload<FixtureValue>
    > = {
      attributes: [
        ...formatted.map((key) => ({ key, value: 42 })),
        { key: '__proto__', value: {} },
        { key: 'future', value: [1] },
      ],
      extra: 42,
      formattedValues: attributes.map((key) => ({ key, value: false })),
      recordId: expected.id,
    };

    expect(normalisePayload(extendedBeaconInput)).toEqual(expected);
  });

  it('cleans text and keys, normalises names/NI/nationality, and parses exact dates', () => {
    const expected = minimalClient({
      date_of_birth: '2024-02-29',
      first_name: 'Priya',
      full_name: 'Priya Anne Mary Bose',
      last_name: 'Bose',
      middle_names: 'Anne  Mary',
      nationality: 'Martian',
      ni_number: 'QQ123456C',
      title: 'Dr',
    });
    const beaconInput: BeaconPayload = {
      attributes: [
        { key: ' firstname ', value: ' Priya ' },
        { key: 'middlename', value: ' Anne  Mary ' },
        { key: 'lastname', value: ' Bose ' },
        { key: 'birthdate', value: ' 29/02/2024 ' },
        { key: 't4a_ninumber', value: ' qq 12\t34 56 c ' },
        { key: 't4a_nationality', value: ' Martian ' },
      ],
      formattedValues: [{ key: 'title', value: ' Dr ' }],
      recordId: expected.id,
    };

    expect(normalisePayload(beaconInput)).toEqual(expected);
  });

  it('cleans all recognized blank values to null/defaults', () => {
    const expected = minimalClient();
    const beaconInput: BeaconPayload = {
      attributes: attributes.map((key) => ({ key, value: ' ' })),
      formattedValues: formatted.map((key) => ({ key, value: null })),
      recordId: expected.id,
    };

    expect(normalisePayload(beaconInput)).toEqual(expected);
  });
});

describe('Beacon addresses and contacts', () => {
  it.each([
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
    [' TrUe ', true],
    [' FaLsE ', false],
    [undefined, false],
  ])('parses primary %j strictly', (primary, expected) => {
    const beaconInput: BeaconPayload = {
      addresses: [{ primary }],
      recordId: '1',
    };

    expect(normalisePayload(beaconInput).addresses).toEqual([
      address({ primary: expected === true }),
    ]);
  });

  it('retains address lines/order, uses shared country lookup, ignores nonexistent move-in fields', () => {
    const extendedBeaconInput: WithAdditionalFields<
      BeaconPayload<FixtureValue>
    > = {
      addresses: [
        {
          city: ' London ',
          country: ' gbr ',
          county: ' County ',
          line1: ' Flat 4, 12 Road ',
          line2: ' Village ',
          movedIn: '2024-01-01',
          postcode: ' w14 9jr ',
          primary: 'false',
        },
        { country: 'Atlantis', line1: ' Second ', primary: true },
        {},
      ],
      recordId: '1',
    };

    expect(normalisePayload(extendedBeaconInput).addresses).toEqual([
      address({
        country: 'GB',
        county: 'County',
        line1: 'Flat 4, 12 Road',
        line2: 'Village',
        postcode: 'W14 9JR',
        town_city: 'London',
      }),
      address({ line1: 'Second', primary: true }),
      address(),
    ]);
  });

  it('drops blank contacts only and preserves usable contact order', () => {
    const extendedBeaconInput: WithAdditionalFields<
      BeaconPayload<FixtureValue>
    > = {
      contacts: [
        {},
        { value: null },
        { value: ' ' },
        { isPrimary: true, type: 3, value: ' 020 7900 1234 ' },
        { type: 2, value: '07700 900123 ext 2' },
        { isPrimary: true, type: 99, value: ' fax ' },
        { extra: {}, type: 1, value: ' a@example.org ' },
      ],
      recordId: '1',
    };

    expect(normalisePayload(extendedBeaconInput).contact_details).toEqual([
      { primary: true, type: 'telephone', value: '+442079001234' },
      { primary: false, type: 'mobile', value: '07700 900123 ext 2' },
      { primary: true, type: 'other', value: 'fax' },
      { primary: false, type: 'email', value: 'a@example.org' },
    ]);
  });
});

describe('Beacon classified validation errors', () => {
  it.each([null, undefined, [], 42, 'text'])(
    'rejects invalid root %j',
    (input) => invalid(input, []),
  );

  it.each([null, undefined, '', ' ', 42, true, {}, []])(
    'rejects invalid recordId %j',
    (recordId) => {
      const malformedBeaconInput: MalformedBeaconPayload = { recordId };

      return invalid(malformedBeaconInput, ['recordId']);
    },
  );

  it.each(['attributes', 'formattedValues', 'addresses', 'contacts'])(
    'rejects malformed %s collections/items',
    (bag) => {
      const malformedBeaconInput: MalformedBeaconPayload = {
        [bag]: {},
        recordId: '1',
      };

      invalid(malformedBeaconInput, [bag]);

      for (const item of [null, 42, [], 'bad']) {
        const malformedBeaconInput: MalformedBeaconPayload = {
          [bag]: [item],
          recordId: '1',
        };

        invalid(malformedBeaconInput, [bag, 0]);
      }
    },
  );

  it.each(['attributes', 'formattedValues'])(
    'validates every %s key including unknown entries',
    (bag) => {
      const emptyInput: Record<string, never> = {};

      for (const key of [undefined, null, '', ' ', 42, emptyInput]) {
        const malformedBeaconInput: MalformedBeaconPayload = {
          [bag]: [{ key, value: null }],
          recordId: '1',
        };

        invalid(malformedBeaconInput, [bag, 0, 'key']);
      }
    },
  );

  it.each(attributes)('rejects wrong value types in attributes.%s', (key) => {
    const emptyInput: Record<string, never> = {};

    for (const value of [42, false, emptyInput, []]) {
      const malformedBeaconInput: MalformedBeaconPayload = {
        attributes: [{ key, value }],
        recordId: '1',
      };

      invalid(malformedBeaconInput, ['attributes', 0, 'value']);
    }
  });

  it.each(formatted)(
    'rejects wrong value types in formattedValues.%s',
    (key) => {
      const emptyInput: Record<string, never> = {};

      for (const value of [42, false, emptyInput, []]) {
        const malformedBeaconInput: MalformedBeaconPayload = {
          formattedValues: [{ key, value }],
          recordId: '1',
        };

        invalid(malformedBeaconInput, ['formattedValues', 0, 'value']);
      }
    },
  );

  it('validates malformed present values even in superseded duplicates', () => {
    const malformedBeaconInput: MalformedBeaconPayload = {
      attributes: [
        { key: 'firstname', value: 42 },
        { key: 'firstname', value: null },
      ],
      recordId: '1',
    };

    invalid(malformedBeaconInput, ['attributes', 0, 'value']);
  });

  it.each([
    '29/02/2023',
    '31/04/1985',
    '1985-07-02',
    '2/7/1985',
    '02/07/1985T00:00:00Z',
  ])('rejects invalid birthdate %s with its original index', (value) => {
    const beaconInput: BeaconPayload = {
      attributes: [
        { key: 'firstname', value: 'Priya' },
        { key: 'birthdate', value },
      ],
      recordId: '1',
    };

    invalid(beaconInput, ['attributes', 1, 'value']);
  });

  it.each(['line1', 'line2', 'city', 'county', 'postcode', 'country'])(
    'rejects invalid address %s',
    (key) => {
      const malformedBeaconInput: MalformedBeaconPayload = {
        addresses: [{ [key]: 42 }],
        recordId: '1',
      };

      invalid(malformedBeaconInput, ['addresses', 0, key]);
    },
  );

  it.each([null, 0, 1, 'yes', '', '1', {}])(
    'rejects invalid address boolean %j',
    (primary) => {
      const malformedBeaconInput: MalformedBeaconPayload = {
        addresses: [{ primary }],
        recordId: '1',
      };

      invalid(malformedBeaconInput, ['addresses', 0, 'primary']);
    },
  );

  it.each([null, 'true', 'false', 0, 1])(
    'rejects invalid contact boolean %j',
    (isPrimary) => {
      const malformedBeaconInput: MalformedBeaconPayload = {
        contacts: [{ isPrimary }],
        recordId: '1',
      };

      invalid(malformedBeaconInput, ['contacts', 0, 'isPrimary']);
    },
  );

  it.each(['1', 1.5, true, {}, [], Infinity])(
    'rejects invalid contact type %j',
    (type) => {
      const malformedBeaconInput: MalformedBeaconPayload = {
        contacts: [{ type }],
        recordId: '1',
      };

      invalid(malformedBeaconInput, ['contacts', 0, 'type']);
    },
  );

  it.each([42, true, {}, []])(
    'rejects non-string contact value %j',
    (value) => {
      const malformedBeaconInput: MalformedBeaconPayload = {
        contacts: [{ value }],
        recordId: '1',
      };

      invalid(malformedBeaconInput, ['contacts', 0, 'value']);
    },
  );
});
