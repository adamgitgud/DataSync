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
    type: 'object',
    origin: 'key',
    input: {},
    key: 'value',
    value: undefined,
  };
}

function bagSchema(keys: readonly string[], dateKey?: string) {
  const recognized = new Set(keys);
  const entry = valibot.pipe(
    entryBase,
    valibot.rawTransform(({ dataset, addIssue, NEVER }) => {
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
          addIssue({ path: [pathToValue()], message: issue.message });
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
  line1: optionalText,
  line2: optionalText,
  city: optionalText,
  county: optionalText,
  postcode: optionalText,
  country: optionalText,
  primary: primarySchema,
});

const contactSchema = recordObject({
  type: valibot.nullish(valibot.pipe(valibot.number(), valibot.integer())),
  value: optionalText,
  isPrimary: valibot.optional(valibot.boolean(), false),
});

const beacon = recordObject({
  recordId: valibot.pipe(
    valibot.string(),
    valibot.trim(),
    valibot.minLength(1),
  ),
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
  formattedValues: valibot.optional(
    bagSchema(['title', 'gendercode', 'familystatuscode']),
    [],
  ),
  addresses: optionalArray(addressSchema),
  contacts: optionalArray(contactSchema),
});

export const beaconClientSchema = asCompatSchema(beacon);

export type BeaconClient = valibot.InferOutput<typeof beacon>;
