import { describe, expect, it } from 'vitest';
import { formatCosperPhone, normalisePhone } from './phones';

describe('conservative phone normalisation', () => {
  it.each([
    ['+44 7700 900123', '+447700900123'],
    ['07700900123', '+447700900123'],
    ['(07700) 900-123', '+447700900123'],
    ['0044 7700 900123', '+447700900123'],
    ['+1 (212) 555-1234', '+12125551234'],
    ['+12345678', '+12345678'],
    ['+123456789012345', '+123456789012345'],
    [' 07700 900123 ext 4 ', '07700 900123 ext 4'],
    ['123 456', '123 456'],
    ['00 33 123456789', '00 33 123456789'],
    ['+12 34567', '+12 34567'],
    ['+1234567890123456', '+1234567890123456'],
    ['07700.900123', '+447700900123'],
    ['07700/900123', '+447700900123'],
  ])('maps %s to %s', (input, expected) =>
    expect(normalisePhone(input)).toBe(expected),
  );

  it.each([null, undefined, '', '  '])(
    'maps blank phone %j to null',
    (input) => {
      expect(normalisePhone(input)).toBeNull();
    },
  );
});

describe('Cosper phone display formatting', () => {
  it.each([
    ['+447700900123', '+44 7700 900123'],
    ['+44 7700 900123', '+44 7700 900123'],
    ['+12125551234', '+12125551234'],
    ['landline', 'landline'],
  ])('maps %s to %s', (input, expected) =>
    expect(formatCosperPhone(input)).toBe(expected),
  );

  it.each([null, undefined, '', '  '])(
    'maps blank phone %j to null',
    (input) => {
      expect(formatCosperPhone(input)).toBeNull();
    },
  );
});
