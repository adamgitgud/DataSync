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
  dateOfBirth: optionalDate,
  firstName: optionalText,
  gender: optionalText,
  lastName: optionalText,
  maritalStatus: optionalText,
  middleName: optionalText,
  nationalityCountry: valibot.nullish(
    recordObject({ isoCode: optionalText, name: optionalText }),
  ),
  niNumber: optionalText,
  title: optionalText,
});

const addressSchema = recordObject({
  buildingName: optionalText,
  countryName: optionalText,
  isPrimary: valibot.optional(valibot.boolean(), false),
  locality: optionalText,
  movedIn: optionalDate,
  postcode: optionalText,
  region: optionalText,
  street: optionalText,
  town: optionalText,
});

const contactSchema = recordObject({
  channel: optionalText,
  detail: optionalText,
  preferred: valibot.optional(valibot.boolean(), false),
});

const acorn = recordObject({
  addresses: optionalArray(addressSchema),
  contactPoints: optionalArray(contactSchema),
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
});

export const acornClientSchema = asCompatSchema(acorn);

export type AcornClient = valibot.InferOutput<typeof acorn>;

export interface AcornClientReference {
  id: string | number;
}
