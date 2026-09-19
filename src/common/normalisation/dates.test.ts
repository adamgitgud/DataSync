import { describe, expect, it } from 'vitest';
import * as valibot from 'valibot';
import { throwInvariant } from '../errors/invariant';
import { isCalendarDate, sourceDateSchema, toDayMonthYear } from './dates';

describe('explicit real calendar dates', () => {
  const uk = sourceDateSchema('DD/MM/YYYY');

  const iso = sourceDateSchema('YYYY-MM-DD');

  it.each([
    ['29/02/2024', '2024-02-29'],
    ['02/07/1985', '1985-07-02'],
    ['29/02/2000', '2000-02-29'],
    ['01/01/0001', '0001-01-01'],
    ['31/12/9999', '9999-12-31'],
  ])('converts %s exactly and reversibly', (input, expected) => {
    expect(uk.parse(input)).toBe(expected);
    expect(iso.parse(expected)).toBe(expected);
    expect(toDayMonthYear(expected)).toBe(input);
  });

  it.each([
    '29/02/2023',
    '31/04/1985',
    '29/02/1900',
    '00/01/2024',
    '01/00/2024',
    '01/13/2024',
    '01/01/0000',
    '2/7/1985',
    '1985-07-02',
    '07-02-1985',
    'tomorrow',
  ])('rejects UK date %s', (input) => {
    expect(uk.safeParse(input).success).toBe(false);
  });

  it.each([
    '2023-02-29',
    '1985-04-31',
    '2024-00-01',
    '2024-13-01',
    '2024-01-00',
    '2024-01-32',
    '0000-01-01',
    '1900-02-29',
    '2024-2-9',
    '02/07/1985',
    '2024-01-01T00:00:00Z',
    ' 2024-01-01 ',
  ])('rejects strict canonical date %s', (input) => {
    expect(isCalendarDate(input)).toBe(false);
    expect(() => toDayMonthYear(input)).toThrow();
  });

  it.each([undefined, null, '', ' \t '])(
    'converts absent date %j to null',
    (input) => {
      expect(uk.parse(input)).toBeNull();
      expect(iso.parse(input)).toBeNull();
    },
  );

  it('cleans source whitespace but rejects invalid structures with the source path', () => {
    expect(uk.parse(' 29/02/2024 ')).toBe('2024-02-29');
    expect(iso.parse(' 2024-02-29 ')).toBe('2024-02-29');

    const emptyInput: Record<string, never> = {};

    for (const input of [42, emptyInput, []]) {
      expect(uk.safeParse(input).success).toBe(false);
    }

    const schema = valibot.object({
      person: valibot.object({ dateOfBirth: iso.schema }),
    });

    const dateInput: valibot.InferInput<typeof schema> = {
      person: { dateOfBirth: '2023-02-29' },
    };

    const result = valibot.safeParse(schema, dateInput);

    expect(result.success).toBe(false);

    if (!result.success) {
      const firstIssue =
        result.issues[0] ?? throwInvariant('Expected a validation issue');

      expect({
        message: firstIssue.message,
        path: firstIssue.path?.map((item) => item.key),
      }).toEqual({
        message: 'Expected a valid YYYY-MM-DD date',
        path: ['person', 'dateOfBirth'],
      });
    }
  });
});
