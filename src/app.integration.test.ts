import type { CanonicalClient } from './clients/schemas/canonical-client.schema';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { app } from './app';

const parseJson = (contents: string): unknown => JSON.parse(contents);

const acorn = parseJson(
  readFileSync(
    new URL('../fixtures/acorn-client.json', import.meta.url),
    'utf8',
  ),
);

const beacon = parseJson(
  readFileSync(
    new URL('../fixtures/beacon-client.json', import.meta.url),
    'utf8',
  ),
);

type Client = CanonicalClient;

type ClientProjection = Pick<
  CanonicalClient,
  | 'title'
  | 'first_name'
  | 'middle_names'
  | 'last_name'
  | 'full_name'
  | 'date_of_birth'
  | 'ni_number'
  | 'legal_sex'
  | 'marital_status'
  | 'nationality'
> & {
  address: {
    content: string;
    town_city: string | null;
    county: string | null;
    postcode: string | null;
    country: CanonicalClient['addresses'][number]['country'];
  };
  email: string | undefined;
  mobile: string | undefined;
};

const request = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

describe('fixture integration paths', () => {
  it('normalises both fixtures through HTTP and compares an independent shared projection', async () => {
    const acornResponse = await app.request(
      '/v1/acorn/clients/normalise',
      request(acorn),
    );

    const beaconResponse = await app.request(
      '/v1/beacon/clients/normalise',
      request(beacon),
    );

    expect(acornResponse.status).toBe(200);
    expect(beaconResponse.status).toBe(200);
    const acornClient = (await acornResponse.json()) as Client;

    const beaconClient = (await beaconResponse.json()) as Client;
    const projection = (client: Client): ClientProjection => ({
      title: client['title'],
      first_name: client['first_name'],
      middle_names: client['middle_names'],
      last_name: client['last_name'],
      full_name: client['full_name'],
      date_of_birth: client['date_of_birth'],
      ni_number: client['ni_number'],
      legal_sex: client['legal_sex'],
      marital_status: client['marital_status'],
      nationality: client['nationality'],
      address: {
        content: [client.addresses[0]?.line1, client.addresses[0]?.line2]
          .filter(Boolean)
          .join(', '),
        town_city: client.addresses[0]?.town_city ?? null,
        county: client.addresses[0]?.county ?? null,
        postcode: client.addresses[0]?.postcode ?? null,
        country: client.addresses[0]?.country ?? null,
      },
      email: client.contact_details.find(
        (contact) => contact.type === 'email' && contact.primary,
      )?.value,
      mobile: client.contact_details.find(
        (contact) => contact.type === 'mobile' && contact.primary,
      )?.value,
    });

    const expected: ClientProjection = {
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
      address: {
        content: 'Flat 4, 12 Vereker Road',
        town_city: 'London',
        county: 'Greater London',
        postcode: 'W14 9JR',
        country: 'GB',
      },
      email: 'priya.cb@example.co.uk',
      mobile: '+447700900123',
    };

    expect(projection(acornClient)).toEqual(expected);
    expect(projection(beaconClient)).toEqual(expected);
    expect(acornClient['id']).toBe('90210');
    expect(beaconClient['id']).toBe('c0ffee7a-1e4b-2c9d-3e00-000000000001');
    expect(acornClient['addresses']).toEqual([
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
    ]);
    expect(beaconClient['addresses']).toEqual([
      {
        primary: true,
        line1: 'Flat 4, 12 Vereker Road',
        line2: null,
        town_city: 'London',
        county: 'Greater London',
        postcode: 'W14 9JR',
        country: 'GB',
        move_in_date: null,
      },
    ]);
    expect(acornClient['contact_details']).toHaveLength(3);
    expect(beaconClient['contact_details']).toHaveLength(2);
  });

  it.each([
    ['acorn', acorn, '90210', 'Flat 4', '12 Vereker Road'],
    [
      'beacon',
      beacon,
      'c0ffee7a-1e4b-2c9d-3e00-000000000001',
      'Flat 4, 12 Vereker Road',
      null,
    ],
  ] as const)(
    'passes the %s canonical result into Cosper over HTTP',
    async (provider, fixture, id, line1, line2) => {
      const normaliseResponse = await app.request(
        `/v1/${provider}/clients/normalise`,
        request(fixture),
      );

      const canonical = await normaliseResponse.json();

      const response = await app.request(
        '/v1/cosper/clients/build-request',
        request(canonical),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        provider: 'cosper',
        request: {
          ClientRef: id,
          Forename: 'Priya',
          Surname: 'Chandra-Bose',
          DateOfBirth: '02/07/1985',
          Sex: 1,
          MaritalStatus: 3,
          AddressLine1: line1,
          AddressLine2: line2,
          Town: 'London',
          Postcode: 'W14 9JR',
          Country: 'United Kingdom',
          Email: 'priya.cb@example.co.uk',
          Telephone: '+44 7700 900123',
        },
        response: { simulated: true, status: 'created', clientRef: id },
        warnings: [],
      });
    },
  );
});
