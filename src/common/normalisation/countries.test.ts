import { describe, expect, it } from 'vitest';
import {
  acornNationality,
  countryName,
  normaliseCountry,
  normaliseNationality,
} from './countries';

describe('limited shared country table', () => {
  it.each([
    ['GB', 'GBR', 'United Kingdom'],
    ['IE', 'IRL', 'Ireland'],
    ['US', 'USA', 'United States'],
    ['FR', 'FRA', 'France'],
    ['DE', 'DEU', 'Germany'],
    ['CA', 'CAN', 'Canada'],
    ['AU', 'AUS', 'Australia'],
    ['NZ', 'NZL', 'New Zealand'],
    ['IN', 'IND', 'India'],
    ['ES', 'ESP', 'Spain'],
  ] as const)(
    'recognizes codes/names for %s and maps outbound consistently',
    (alpha2, alpha3, name) => {
      for (const alias of [alpha2, alpha3, name]) {
        expect(normaliseCountry(` ${alias.toLowerCase()} `)).toBe(alpha2);
        expect(normaliseNationality(alias)).toBe(name);
      }

      expect(countryName(alpha2)).toBe(name);
    },
  );

  it('handles UK and British narrowly, preserving unknown nationality only', () => {
    expect(normaliseCountry(' Uk ')).toBe('GB');
    expect(normaliseCountry('England')).toBe('GB');
    expect(normaliseCountry(' Scotland ')).toBe('GB');
    expect(normaliseNationality(' bRiTiSh ')).toBe('United Kingdom');
    expect(normaliseCountry('British')).toBeNull();
    expect(normaliseCountry('Atlantis')).toBeNull();
    expect(normaliseNationality(' Martian ')).toBe('Martian');
    expect(acornNationality('FR', 'Germany')).toBe('France');
    expect(acornNationality('invalid', ' IRL ')).toBe('Ireland');
    expect(acornNationality('invalid', ' Martian ')).toBe('Martian');
    expect(acornNationality('invalid', null)).toBeNull();
    expect(countryName(null)).toBeNull();
  });

  it.each([null, undefined, '', '  '])(
    'maps absent country/nationality %j to null',
    (input) => {
      expect(normaliseCountry(input)).toBeNull();
      expect(normaliseNationality(input)).toBeNull();
    },
  );
});
