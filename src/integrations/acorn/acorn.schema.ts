import * as valibot from 'valibot';
import { sourceDateSchema } from '../../common/normalisation/dates';
import { sourceTextSchema } from '../../common/normalisation/text';
import { asCompatSchema } from '../../common/validation/schema-compat';
import { optionalArray, recordObject } from '../../common/validation/source';

const sourceText = sourceTextSchema.schema;
const optionalText = valibot.optional(sourceText, null);
const optionalDate = valibot.optional(
  sourceDateSchema('YYYY-MM-DD').schema,
  null,
);
const personSchema = recordObject({
  title: optionalText,
  firstName: optionalText,
  middleName: optionalText,
  lastName: optionalText,
  dateOfBirth: optionalDate,
  niNumber: optionalText,
  gender: optionalText,
  maritalStatus: optionalText,
  nationalityCountry: valibot.nullish(
    recordObject({ name: optionalText, isoCode: optionalText }),
  ),
});

const addressSchema = recordObject({
  isPrimary: valibot.optional(valibot.boolean(), false),
  buildingName: optionalText,
  street: optionalText,
  locality: optionalText,
  town: optionalText,
  region: optionalText,
  postcode: optionalText,
  countryName: optionalText,
  movedIn: optionalDate,
});

const contactSchema = recordObject({
  channel: optionalText,
  detail: optionalText,
  preferred: valibot.optional(valibot.boolean(), false),
});

const acorn = recordObject({
  id: valibot.pipe(
    valibot.union([
      valibot.pipe(
        valibot.number(),
        valibot.integer(),
        valibot.minValue(0),
        valibot.maxValue(Number.MAX_SAFE_INTEGER),
      ),
      valibot.pipe(valibot.string(), valibot.trim(), valibot.minLength(1)),
    ]),
    valibot.transform(String),
  ),
  person: valibot.nullish(personSchema),
  addresses: optionalArray(addressSchema),
  contactPoints: optionalArray(contactSchema),
});

export const acornClientSchema = asCompatSchema(acorn);

export type AcornClient = valibot.InferOutput<typeof acorn>;

export interface AcornClientReference {
  id: string | number;
}
