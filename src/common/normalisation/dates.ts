import * as valibot from 'valibot';
import {
  asCompatSchema,
  type CompatValidatedSchema,
} from '../validation/schema-compat';
import { throwInvariant } from '../errors/invariant';
import { sourceTextSchema } from './text';

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY';

function calendarDate(value: string, format: DateFormat): string | null {
  const pattern =
    format === 'YYYY-MM-DD'
      ? /^(\d{4})-(\d{2})-(\d{2})$/
      : /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = pattern.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(
    match[format === 'YYYY-MM-DD' ? 1 : 3] ??
      throwInvariant('Missing year capture'),
  );
  const month = Number(match[2] ?? throwInvariant('Missing month capture'));
  const day = Number(
    match[format === 'YYYY-MM-DD' ? 3 : 1] ??
      throwInvariant('Missing day capture'),
  );
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maximum = days[month - 1];

  if (year < 1 || maximum === undefined || day < 1 || day > maximum) {
    return null;
  }

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isCalendarDate(
  value: string,
  format: DateFormat = 'YYYY-MM-DD',
): boolean {
  return calendarDate(value, format) !== null;
}

export function sourceDateSchema(
  format: DateFormat,
): CompatValidatedSchema<string | null> {
  return asCompatSchema(
    valibot.pipe(
      sourceTextSchema.schema,
      valibot.rawTransform(({ dataset, addIssue, NEVER }) => {
        if (dataset.value === null) {
          return null;
        }

        const parsed = calendarDate(dataset.value, format);

        if (parsed === null) {
          addIssue({ message: `Expected a valid ${format} date` });

          return NEVER;
        }

        return parsed;
      }),
    ),
  );
}

export const canonicalDateSchema: CompatValidatedSchema<string> =
  asCompatSchema(
    valibot.pipe(
      valibot.string(),
      valibot.check(
        (value) => isCalendarDate(value),
        'Expected a valid YYYY-MM-DD date',
      ),
    ),
  );

export function toDayMonthYear(value: string): string {
  const valid = canonicalDateSchema.parse(value);

  return `${valid.slice(8, 10)}/${valid.slice(5, 7)}/${valid.slice(0, 4)}`;
}
