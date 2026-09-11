import * as valibot from 'valibot';
import { asCompatSchema } from '../../common/validation/schema-compat';
import { isCalendarDate } from '../../common/normalisation/dates';

export type CosperWarningCode =
  | 'MARITAL_STATUS_UNREPRESENTABLE'
  | 'MARITAL_STATUS_UNKNOWN'
  | 'LEGAL_SEX_DEFAULTED';

export interface CosperWarning {
  code: CosperWarningCode;
  path: (string | number)[];
  message: string;
}

export interface CosperBuildResult {
  request: CosperRequest;
  warnings: CosperWarning[];
  response: { simulated: true; status: 'created'; clientRef: string };
}

export const cosperRequestSchema = asCompatSchema(
  valibot.strictObject({
    ClientRef: valibot.string(),
    Forename: valibot.nullable(valibot.string()),
    Surname: valibot.nullable(valibot.string()),
    DateOfBirth: valibot.nullable(
      valibot.pipe(
        valibot.string(),
        valibot.check(
          (value) => isCalendarDate(value, 'DD/MM/YYYY'),
          'Expected a valid DD/MM/YYYY date',
        ),
      ),
    ),
    Sex: valibot.picklist([0, 1, 2]),
    MaritalStatus: valibot.picklist([0, 1, 2, 3, 4, 5, 6, 7]),
    AddressLine1: valibot.nullable(valibot.string()),
    AddressLine2: valibot.nullable(valibot.string()),
    Town: valibot.nullable(valibot.string()),
    Postcode: valibot.nullable(valibot.string()),
    Country: valibot.nullable(valibot.string()),
    Email: valibot.nullable(valibot.string()),
    Telephone: valibot.nullable(valibot.string()),
  }),
);

export type CosperRequest = valibot.InferOutput<
  typeof cosperRequestSchema.schema
>;
