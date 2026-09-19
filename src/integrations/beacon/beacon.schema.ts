import * as valibot from 'valibot';
import { sourceDateSchema } from '../../common/normalisation/dates';
import { sourceTextSchema } from '../../common/normalisation/text';
import { asCompatSchema } from '../../common/validation/schema-compat';
import { optionalArray, recordObject } from '../../common/validation/source';

const sourceText = sourceTextSchema.schema;
const optionalText = valibot.optional(sourceText, null);
const entryBase = recordObject({
  key: valibot.pipe(valibot.string(), valibot.trim(), valibot.minLength(1)),
  value: valibot.optional(valibot.unknown()),
});

function pathToValue(): valibot.IssuePathItem {
  return {
    input: {},
    key: 'value',
    origin: 'key',
    type: 'object',
    value: undefined,
  };
}

function bagSchema(keys: readonly string[], dateKey?: string) {
  const recognized = new Set(keys);
  const entry = valibot.pipe(
    entryBase,
    valibot.rawTransform(({ addIssue, dataset, NEVER }) => {
      if (!recognized.has(dataset.value.key)) {
        return { key: dataset.value.key, value: null };
      }

      const schema =
        dataset.value.key === dateKey
          ? sourceDateSchema('DD/MM/YYYY')
          : sourceTextSchema;
      const result = schema.safeParse(dataset.value.value);

      if (!result.success) {
        for (const issue of result.error.issues) {
          addIssue({ message: issue.message, path: [pathToValue()] });
        }

        return NEVER;
      }

      return { key: dataset.value.key, value: result.data };
    }),
  );

  return valibot.pipe(
    valibot.nullish(valibot.array(entry)),
    valibot.transform((entries) => {
      const indexed = new Map<string, string | null>();

      for (const item of entries ?? []) {
        if (recognized.has(item.key)) {
          indexed.set(item.key, item.value);
        }
      }

      return indexed;
    }),
  );
}

const primarySchema = valibot.optional(
  valibot.union([
    valibot.boolean(),
    valibot.pipe(
      valibot.string(),
      valibot.trim(),
      valibot.transform((value) => value.toLowerCase()),
      valibot.picklist(['true', 'false']),
      valibot.transform((value) => value === 'true'),
    ),
  ]),
  false,
);

const addressSchema = recordObject({
  city: optionalText,
  country: optionalText,
  county: optionalText,
  line1: optionalText,
  line2: optionalText,
  postcode: optionalText,
  primary: primarySchema,
});

const contactSchema = recordObject({
  isPrimary: valibot.optional(valibot.boolean(), false),
  type: valibot.nullish(valibot.pipe(valibot.number(), valibot.integer())),
  value: optionalText,
});

const beacon = recordObject({
  addresses: optionalArray(addressSchema),
  attributes: valibot.optional(
    bagSchema(
      [
        'firstname',
        'middlename',
        'lastname',
        'birthdate',
        't4a_ninumber',
        't4a_nationality',
      ],
      'birthdate',
    ),
    [],
  ),
  contacts: optionalArray(contactSchema),
  formattedValues: valibot.optional(
    bagSchema(['title', 'gendercode', 'familystatuscode']),
    [],
  ),
  recordId: valibot.pipe(
    valibot.string(),
    valibot.trim(),
    valibot.minLength(1),
  ),
});

export const beaconClientSchema = asCompatSchema(beacon);

export type BeaconClient = valibot.InferOutput<typeof beacon>;
