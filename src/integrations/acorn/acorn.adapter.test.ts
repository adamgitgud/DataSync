import type {
  MalformedAcornPayload,
  WithAdditionalFields,
  AcornPayload,
} from '../../testing/payloads';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalClientSchema } from '../../clients/schemas/canonical-client.schema';
import { normaliseAcorn } from './acorn.adapter';
import { InputValidationError } from '../../common/validation/input-validation';
import { address, minimalClient } from '../../testing/factories';

const fixture: unknown = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/acorn-client.json', import.meta.url),
    'utf8',
  ),
);

function expectInvalid(input: unknown, path: (string | number)[]) {
  expect(() => normaliseAcorn(input)).toThrow(InputValidationError);

  try {
    normaliseAcorn(input);
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

    const result = normaliseAcorn(fixture);

    expect(result).toEqual({
      id: '90210',
      title: 'Mrs',
      first_name: 'Priya',
      middle_names: null,
      last_name: 'Chandra-Bose',
      full_name: 'Priya Chandra-Bose',
      date_of_birth: '1985-07-02',
      ni_number: 'QQ123456C',
      legal_sex: 'female',
      marital_status: 'cohabiting',
      nationality: 'United Kingdom',
      addresses: [
        {
          primary: true,
          line1: 'Flat 4',
          line2: '12 Vereker Road',
          town_city: 'London',
          county: 'Greater London',
          postcode: 'W14 9JR',
          country: 'GB',
          move_in_date: '2016-03-01',
        },
      ],
      contact_details: [
        { type: 'email', value: 'priya.cb@example.co.uk', primary: true },
        { type: 'mobile', value: '+447700900123', primary: true },
        { type: 'email', value: 'priya@oldmail.example', primary: false },
      ],
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

    expect(normaliseAcorn(acornInput).legal_sex).toBe(expected);

    if (typeof gender === 'string') {
      const acornInput: AcornPayload = {
        id: 1,
        person: { gender: ` ${gender.toUpperCase()} ` },
      };

      expect(normaliseAcorn(acornInput).legal_sex).toBe(expected);
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

    expect(normaliseAcorn(acornInput).marital_status).toBe(expected);

    if (typeof maritalStatus === 'string') {
      const acornInput: AcornPayload = {
        id: 1,
        person: { maritalStatus: ` ${maritalStatus.toUpperCase()} ` },
      };

      expect(normaliseAcorn(acornInput).marital_status).toBe(expected);
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
          id: 1,
          contactPoints: [{ channel: label, detail: ' 07700 900123 ' }],
        };

        expect(normaliseAcorn(acornInput).contact_details).toEqual([
          {
            type: expected,
            value:
              expected === 'mobile' || expected === 'telephone'
                ? '+447700900123'
                : '07700 900123',
            primary: false,
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

      expect(normaliseAcorn(acornInput)).toEqual(minimalClient({ id: '0' }));
    },
  );

  it.each([0, 90210, Number.MAX_SAFE_INTEGER, ' external-id ', '0'])(
    'preserves valid provider ID %j',
    (id) => {
      const acornInput: AcornPayload = { id };

      expect(normaliseAcorn(acornInput).id).toBe(String(id).trim());
    },
  );

  it.each([undefined, null, []])(
    'normalises missing/null collections %j to arrays',
    (items) => {
      const expected = minimalClient();
      const acornInput: AcornPayload = {
        id: expected.id,
        addresses: items,
        contactPoints: items,
      };

      expect(normaliseAcorn(acornInput)).toEqual(expected);
    },
  );

  it('cleans all optional text, names, NI and postcode, preserving free nationality', () => {
    const expected = minimalClient({
      title: 'Dr',
      first_name: 'Priya',
      middle_names: 'Anne  Mary',
      last_name: 'Bose',
      full_name: 'Priya Anne Mary Bose',
      ni_number: 'QQ123456C',
      nationality: 'Martian',
      date_of_birth: '2024-02-29',
      addresses: [
        address({
          town_city: 'London',
          county: 'Greater London',
          postcode: 'W14 9JR',
          country: 'GB',
        }),
      ],
    });
    const acornInput: AcornPayload = {
      id: expected.id,
      person: {
        title: ' Dr ',
        firstName: ' Priya ',
        middleName: ' Anne  Mary ',
        lastName: ' Bose ',
        niNumber: ' qq 12\t34 56 c ',
        nationalityCountry: { isoCode: 'invalid', name: ' Martian ' },
        dateOfBirth: ' 2024-02-29 ',
      },
      addresses: [
        {
          town: ' London ',
          region: ' Greater London ',
          postcode: ' w14 9jr ',
          countryName: ' uk ',
        },
      ],
    };

    expect(normaliseAcorn(acornInput)).toEqual(expected);
  });

  it('turns blank optional fields into null and retains an empty address', () => {
    const expected = minimalClient({ addresses: [address()] });
    const acornInput: AcornPayload = {
      id: expected.id,
      person: {
        title: ' ',
        firstName: '',
        middleName: null,
        lastName: '\t',
        dateOfBirth: ' ',
        niNumber: '',
        nationalityCountry: null,
      },
      addresses: [
        {
          buildingName: '',
          street: ' ',
          locality: null,
          town: '',
          region: ' ',
          postcode: '\t',
          countryName: 'Atlantis',
          movedIn: ' ',
        },
      ],
    };

    expect(normaliseAcorn(acornInput)).toEqual(expected);
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

      expect(normaliseAcorn(acornInput).nationality).toBe(expected);
    }
  });

  it('drops only blank contacts and preserves all usable values and source ordering', () => {
    const acornInput: AcornPayload = {
      id: 1,
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
    };

    expect(normaliseAcorn(acornInput).contact_details).toEqual([
      { type: 'mobile', value: '07700 900123 ext 4', primary: true },
      { type: 'other', value: 'fax:123', primary: false },
      { type: 'email', value: 'a@example.org', primary: true },
    ]);
  });

  it('ignores extra provider keys at each level', () => {
    const expected = minimalClient({
      addresses: [address()],
      contact_details: [{ type: 'other', value: 'abc', primary: false }],
    });
    const extendedAcornInput: WithAdditionalFields<AcornPayload> = {
      id: expected.id,
      future: {},
      person: { future: 42, nationalityCountry: { future: [] } },
      addresses: [{ kind: 'Home', future: 42 }],
      contactPoints: [{ detail: 'abc', future: [] }],
    };

    expect(normaliseAcorn(extendedAcornInput)).toEqual(expected);
  });
});

describe('Acorn address layout', () => {
  it.each([
    ['Flat 4', '12 Road', 'Village', 'Flat 4', '12 Road, Village'],
    ['Flat 4', '12 Road', null, 'Flat 4', '12 Road'],
    ['Flat 4', null, 'Village', 'Flat 4', 'Village'],
    ['Flat 4', null, null, 'Flat 4', null],
    [null, '12 Road', 'Village', '12 Road', 'Village'],
    [null, '12 Road', null, '12 Road', null],
    [null, null, 'Village', 'Village', null],
    [null, null, null, null, null],
  ])(
    'lays out building=%j street=%j locality=%j',
    (buildingName, street, locality, line1, line2) => {
      const acornInput: AcornPayload = {
        id: 1,
        addresses: [{ buildingName, street, locality }],
      };

      expect(normaliseAcorn(acornInput).addresses).toEqual([
        address({ line1: line1 ?? null, line2: line2 ?? null }),
      ]);
    },
  );

  it('cleans components before composing and never reorders primary addresses', () => {
    const acornInput: AcornPayload = {
      id: 1,
      addresses: [
        { buildingName: ' ', street: ' Road ', locality: ' Village ' },
        {
          buildingName: ' Building ',
          street: ' Road ',
          locality: ' Village ',
          isPrimary: true,
        },
      ],
    };

    expect(normaliseAcorn(acornInput).addresses).toEqual([
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
      id: 1,
      addresses: [{ [key]: 42 }],
    };

    return expectInvalid(malformedAcornInput, ['addresses', 0, key]);
  });

  it.each(['channel', 'detail'])(
    'rejects non-text contact %s even if detail would be dropped',
    (key) => {
      const malformedAcornInput: MalformedAcornPayload = {
        id: 1,
        contactPoints: [{ [key]: 42 }],
      };

      expectInvalid(malformedAcornInput, ['contactPoints', 0, key]);
    },
  );

  it.each(['true', 'false', 1, 0, null])(
    'rejects nonboolean flags %j',
    (flag) => {
      const malformedAcornInput: MalformedAcornPayload = {
        id: 1,
        addresses: [{ isPrimary: flag }],
      };

      expectInvalid(malformedAcornInput, ['addresses', 0, 'isPrimary']);
      const malformedAcornInput2: MalformedAcornPayload = {
        id: 1,
        contactPoints: [{ preferred: flag }],
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
        id: 1,
        addresses: [{ movedIn: date }],
      };

      expectInvalid(acornInput2, ['addresses', 0, 'movedIn']);
    },
  );
});
