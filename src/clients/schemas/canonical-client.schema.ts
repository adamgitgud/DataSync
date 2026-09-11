import * as valibot from 'valibot';
import { asCompatSchema } from '../../common/validation/schema-compat';
import { canonicalDateSchema } from '../../common/normalisation/dates';
import { countryCodeSchema } from '../../common/normalisation/countries';

const countryCode = countryCodeSchema.schema;

const trimmedNonEmptyText = valibot.pipe(
  valibot.string(),
  valibot.minLength(1),
  valibot.check(
    (textValue) => textValue === textValue.trim(),
    'Expected nonempty trimmed text',
  ),
);

const canonicalCalendarDate = canonicalDateSchema.schema;

export const canonicalTextSchema = asCompatSchema(trimmedNonEmptyText);

const nullableTrimmedText = valibot.nullable(trimmedNonEmptyText);

export const legalSexSchema = asCompatSchema(
  valibot.picklist(['male', 'female', 'other', 'unspecified']),
);

export const maritalStatusSchema = asCompatSchema(
  valibot.picklist([
    'single',
    'married',
    'civil-partner',
    'cohabiting',
    'engaged',
    'separated',
    'divorced',
    'widowed',
    'unknown',
  ]),
);

export const contactTypeSchema = asCompatSchema(
  valibot.picklist(['email', 'mobile', 'telephone', 'other']),
);

const uppercasePostcodeText = valibot.pipe(
  valibot.string(),
  valibot.minLength(1),
  valibot.check((textValue) => textValue === textValue.trim()),
  valibot.check(
    (textValue) => textValue === textValue.toUpperCase(),
    'Expected uppercase postcode',
  ),
);

const uppercaseNiNumberText = valibot.pipe(
  valibot.string(),
  valibot.minLength(1),
  valibot.check(
    (textValue) =>
      !/\s/.test(textValue) &&
      textValue === textValue.trim() &&
      textValue === textValue.toUpperCase(),
    'Expected uppercase NI number without whitespace',
  ),
);

const canonicalAddressObject = valibot.object({
  primary: valibot.boolean(),
  line1: nullableTrimmedText,
  line2: nullableTrimmedText,
  town_city: nullableTrimmedText,
  county: nullableTrimmedText,
  postcode: valibot.nullable(uppercasePostcodeText),
  country: valibot.nullable(countryCode),
  move_in_date: valibot.nullable(canonicalCalendarDate),
});

export const canonicalAddressSchema = asCompatSchema(canonicalAddressObject);

const canonicalContactObject = valibot.object({
  type: contactTypeSchema.schema,
  value: trimmedNonEmptyText,
  primary: valibot.boolean(),
});

export const canonicalContactDetailSchema = asCompatSchema(
  canonicalContactObject,
);

const canonicalClientObject = valibot.object({
  id: trimmedNonEmptyText,
  title: nullableTrimmedText,
  first_name: nullableTrimmedText,
  middle_names: nullableTrimmedText,
  last_name: nullableTrimmedText,
  full_name: nullableTrimmedText,
  date_of_birth: valibot.nullable(canonicalCalendarDate),
  ni_number: valibot.nullable(uppercaseNiNumberText),
  legal_sex: valibot.nullable(legalSexSchema.schema),
  marital_status: maritalStatusSchema.schema,
  nationality: nullableTrimmedText,
  addresses: valibot.array(canonicalAddressObject),
  contact_details: valibot.array(canonicalContactObject),
});

export const canonicalClientSchema = asCompatSchema(canonicalClientObject);

export type LegalSex = valibot.InferOutput<typeof legalSexSchema.schema>;

export type MaritalStatus = valibot.InferOutput<
  typeof maritalStatusSchema.schema
>;

export type ContactType = valibot.InferOutput<typeof contactTypeSchema.schema>;

export type CanonicalAddress = valibot.InferOutput<
  typeof canonicalAddressObject
>;

export type CanonicalContactDetail = valibot.InferOutput<
  typeof canonicalContactObject
>;

export type CanonicalClient = valibot.InferOutput<typeof canonicalClientObject>;

export function createEmptyCanonicalClient(): CanonicalClient {
  return {
    id: 'UNKNOWN',
    title: null,
    first_name: null,
    middle_names: null,
    last_name: null,
    full_name: null,
    date_of_birth: null,
    ni_number: null,
    legal_sex: null,
    marital_status: 'unknown',
    nationality: null,
    addresses: [],
    contact_details: [],
  };
}
