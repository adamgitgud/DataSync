import * as valibot from 'valibot';
import {
  asCompatSchema,
  type CompatValidatedSchema,
} from '../validation/schema-compat';

export function cleanText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export const sourceTextSchema: CompatValidatedSchema<string | null> =
  asCompatSchema(
    valibot.pipe(
      valibot.nullish(valibot.string()),
      valibot.transform(cleanText),
    ),
  );

export function fullName(
  ...parts: (string | null | undefined)[]
): string | null {
  const collapsed = parts
    .map((part) => cleanText(part)?.replace(/\s+/g, ' ') ?? null)
    .filter((part): part is string => part !== null);

  return cleanText(collapsed.join(' '));
}

export function normaliseNi(value: string | null | undefined): string | null {
  return cleanText(value)?.replace(/\s/g, '').toUpperCase() ?? null;
}

export function normalisePostcode(
  value: string | null | undefined,
): string | null {
  return cleanText(value)?.toUpperCase() ?? null;
}
