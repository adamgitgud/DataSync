import { describe, expect, it } from 'vitest';
import {
  cleanText,
  fullName,
  normaliseNi,
  normalisePostcode,
  sourceTextSchema,
} from './text';

describe('text cleanup', () => {
  it.each([undefined, null, '', ' \t\n '])(
    'normalises absent/blank text %j to null',
    (input) => {
      expect(cleanText(input)).toBeNull();
      expect(sourceTextSchema.parse(input)).toBeNull();
      expect(normaliseNi(input)).toBeNull();
      expect(normalisePostcode(input)).toBeNull();
    },
  );

  it('trims without rewriting interior text; composes a full name without title', () => {
    expect(cleanText('  Chandra-Bose  ')).toBe('Chandra-Bose');
    expect(cleanText('Flat  4')).toBe('Flat  4');
    expect(fullName(' Priya ', null, 'Chandra-Bose ')).toBe(
      'Priya Chandra-Bose',
    );
    expect(fullName(' Priya ', ' Anne\t Mary ', ' Chandra-Bose ')).toBe(
      'Priya Anne Mary Chandra-Bose',
    );
    expect(fullName(null, ' ', undefined)).toBeNull();
    expect(normaliseNi(' qq\t12 34\n56 c ')).toBe('QQ123456C');
    expect(normalisePostcode(' w14 9jr ')).toBe('W14 9JR');
  });

  it.each([2, false, [], {}])(
    'rejects supplied non-string text %j',
    (input) => {
      expect(sourceTextSchema.safeParse(input).success).toBe(false);
    },
  );
});
