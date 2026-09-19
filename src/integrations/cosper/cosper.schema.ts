import * as valibot from 'valibot';
import { asCompatSchema } from '../../common/validation/schema-compat';
import { isCalendarDate } from '../../common/normalisation/dates';

export type CosperWarningCode =
  | 'MARITAL_STATUS_UNREPRESENTABLE'
  | 'MARITAL_STATUS_UNKNOWN'
  | 'LEGAL_SEX_DEFAULTED';

export interface CosperWarning {
  code: CosperWarningCode;
  message: string;
  path: (string | number)[];
}

export interface CosperBuildResult {
  request: CosperRequest;
  response: { clientRef: string; simulated: true; status: 'created' };
  warnings: CosperWarning[];
}

export const cosperRequestSchema = asCompatSchema(
  valibot.strictObject({
    AddressLine1: valibot.nullable(valibot.string()),
    AddressLine2: valibot.nullable(valibot.string()),
    ClientRef: valibot.string(),
    Country: valibot.nullable(valibot.string()),
    DateOfBirth: valibot.nullable(
      valibot.pipe(
        valibot.string(),
        valibot.check(
          (value) => isCalendarDate(value, 'DD/MM/YYYY'),
          'Expected a valid DD/MM/YYYY date',
        ),
      ),
    ),
    Email: valibot.nullable(valibot.string()),
    Forename: valibot.nullable(valibot.string()),
    MaritalStatus: valibot.picklist([0, 1, 2, 3, 4, 5, 6, 7]),
    Postcode: valibot.nullable(valibot.string()),
    Sex: valibot.picklist([0, 1, 2]),
    Surname: valibot.nullable(valibot.string()),
    Telephone: valibot.nullable(valibot.string()),
    Town: valibot.nullable(valibot.string()),
  }),
);

export type CosperRequest = valibot.InferOutput<
  typeof cosperRequestSchema.schema
>;
