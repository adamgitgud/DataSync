import * as valibot from 'valibot';

export type JsonValue =
  string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

export type RawQuery = Record<string, string | string[] | undefined>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function recordObject<const TEntries extends valibot.ObjectEntries>(
  entries: TEntries,
) {
  return valibot.pipe(
    valibot.unknown(),
    valibot.check(isRecord, 'Expected an object'),
    valibot.object(entries),
  );
}

export function optionalArray<
  const TItem extends valibot.BaseSchema<
    unknown,
    unknown,
    valibot.BaseIssue<unknown>
  >,
>(item: TItem) {
  return valibot.optional(
    valibot.pipe(
      valibot.nullish(valibot.array(item)),
      valibot.transform((items) => items ?? []),
    ),
    [],
  );
}
