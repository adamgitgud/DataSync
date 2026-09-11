import * as valibot from 'valibot';
import {
  asCompatSchema,
  type CompatValidatedSchema,
} from '../validation/schema-compat';
import { cleanText } from './text';

interface Country {
  readonly alpha2: string;
  readonly alpha3: string;
  readonly name: string;
  readonly aliases: readonly string[];
}

export const countries = [
  {
    alpha2: 'GB',
    alpha3: 'GBR',
    name: 'United Kingdom',
    aliases: ['UK', 'England', 'Scotland', 'Wales', 'Northern Ireland'],
  },
  { alpha2: 'IE', alpha3: 'IRL', name: 'Ireland', aliases: [] },
  { alpha2: 'US', alpha3: 'USA', name: 'United States', aliases: [] },
  { alpha2: 'FR', alpha3: 'FRA', name: 'France', aliases: [] },
  { alpha2: 'DE', alpha3: 'DEU', name: 'Germany', aliases: [] },
  { alpha2: 'CA', alpha3: 'CAN', name: 'Canada', aliases: [] },
  { alpha2: 'AU', alpha3: 'AUS', name: 'Australia', aliases: [] },
  { alpha2: 'NZ', alpha3: 'NZL', name: 'New Zealand', aliases: [] },
  { alpha2: 'IN', alpha3: 'IND', name: 'India', aliases: [] },
  { alpha2: 'ES', alpha3: 'ESP', name: 'Spain', aliases: [] },
] as const satisfies readonly Country[];

export type CountryCode = (typeof countries)[number]['alpha2'];

export type CountryName = (typeof countries)[number]['name'];

export const countryCodeSchema: CompatValidatedSchema<CountryCode> =
  asCompatSchema(valibot.picklist(countries.map((country) => country.alpha2)));

const countryLookup = new Map<string, (typeof countries)[number]>();

for (const country of countries) {
  for (const alias of [
    country.alpha2,
    country.alpha3,
    country.name,
    ...country.aliases,
  ]) {
    countryLookup.set(alias.toLowerCase(), country);
  }
}

export function lookupCountry(value: string | null | undefined) {
  const key = cleanText(value)?.toLowerCase();

  if (key === null || key === undefined) {
    return undefined;
  }

  return countryLookup.get(key);
}

export function normaliseCountry(
  value: string | null | undefined,
): CountryCode | null {
  return lookupCountry(value)?.alpha2 ?? null;
}

export function normaliseNationality(
  value: string | null | undefined,
): string | null {
  const cleaned = cleanText(value);

  if (cleaned?.toLowerCase() === 'british') {
    return 'United Kingdom';
  }

  return lookupCountry(cleaned)?.name ?? cleaned;
}

export function acornNationality(
  code: string | null | undefined,
  name: string | null | undefined,
): string | null {
  return lookupCountry(code)?.name ?? normaliseNationality(name);
}

export function countryName(code: CountryCode | null): CountryName | null {
  return lookupCountry(code)?.name ?? null;
}
