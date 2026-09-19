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
    country: CanonicalClient['addresses'][number]['country'];
    county: string | null;
    postcode: string | null;
    town_city: string | null;
  };
  email: string | undefined;
  mobile: string | undefined;
};

const request = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
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
      address: {
        content: [client.addresses[0]?.line1, client.addresses[0]?.line2]
          .filter(Boolean)
          .join(', '),
        country: client.addresses[0]?.country ?? null,
        county: client.addresses[0]?.county ?? null,
        postcode: client.addresses[0]?.postcode ?? null,
        town_city: client.addresses[0]?.town_city ?? null,
      },
      date_of_birth: client.date_of_birth,
      email: client.contact_details.find(
        (contact) => contact.type === 'email' && contact.primary,
      )?.value,
      first_name: client.first_name,
      full_name: client.full_name,
      last_name: client.last_name,
      legal_sex: client.legal_sex,
      marital_status: client.marital_status,
      middle_names: client.middle_names,
      mobile: client.contact_details.find(
        (contact) => contact.type === 'mobile' && contact.primary,
      )?.value,
      nationality: client.nationality,
      ni_number: client.ni_number,
      title: client.title,
    });

    const expected: ClientProjection = {
      address: {
        content: 'Flat 4, 12 Vereker Road',
        country: 'GB',
        county: 'Greater London',
        postcode: 'W14 9JR',
        town_city: 'London',
      },
      date_of_birth: '1985-07-02',
      email: 'priya.cb@example.co.uk',
      first_name: 'Priya',
      full_name: 'Priya Chandra-Bose',
      last_name: 'Chandra-Bose',
      legal_sex: 'female',
      marital_status: 'cohabiting',
      middle_names: null,
      mobile: '+447700900123',
      nationality: 'United Kingdom',
      ni_number: 'QQ123456C',
      title: 'Mrs',
    };

    expect(projection(acornClient)).toEqual(expected);
    expect(projection(beaconClient)).toEqual(expected);
    expect(acornClient.id).toBe('90210');
    expect(beaconClient.id).toBe('c0ffee7a-1e4b-2c9d-3e00-000000000001');
    expect(acornClient.addresses).toEqual([
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
    ]);
    expect(beaconClient.addresses).toEqual([
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
    ]);
    expect(acornClient.contact_details).toHaveLength(3);
    expect(beaconClient.contact_details).toHaveLength(2);
  });

  it.each([
    {
      fixture: acorn,
      id: '90210',
      line1: 'Flat 4',
      line2: '12 Vereker Road',
      provider: 'acorn',
    },
    {
      fixture: beacon,
      id: 'c0ffee7a-1e4b-2c9d-3e00-000000000001',
      line1: 'Flat 4, 12 Vereker Road',
      line2: null,
      provider: 'beacon',
    },
  ] as const)(
    'passes the canonical result into Cosper over HTTP',
    async ({ fixture, id, line1, line2, provider }) => {
      const normaliseResponse = await app.request(
        `/v1/${provider}/clients/normalise`,
        request(fixture),
      );

      const canonical: unknown = await normaliseResponse.json();

      const response = await app.request(
        '/v1/cosper/clients/build-request',
        request(canonical),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        provider: 'cosper',
        request: {
          AddressLine1: line1,
          AddressLine2: line2,
          ClientRef: id,
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
        response: { clientRef: id, simulated: true, status: 'created' },
        warnings: [],
      });
    },
  );
});
