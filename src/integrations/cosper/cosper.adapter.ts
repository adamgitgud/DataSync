import {
  canonicalClientSchema,
  type MaritalStatus,
} from '../../clients/schemas/canonical-client.schema';
import { countryName } from '../../common/normalisation/countries';
import { formatCosperPhone } from '../../common/normalisation/phones';
import {
  selectAddress,
  selectEmail,
  selectPhone,
} from '../../common/normalisation/selection';
import { toDayMonthYear } from '../../common/normalisation/dates';
import {
  InputValidationError,
  parseInput,
} from '../../common/validation/input-validation';
import { throwInvariant } from '../../common/errors/invariant';
import { InvalidBuildResultError } from '../../common/errors/domain.error';
import {
  cosperRequestSchema,
  type CosperBuildResult,
  type CosperRequest,
  type CosperWarning,
} from './cosper.schema';

const maritalCodes: Record<MaritalStatus, CosperRequest['MaritalStatus']> = {
  single: 1,
  married: 2,
  cohabiting: 3,
  'civil-partner': 4,
  separated: 5,
  divorced: 6,
  widowed: 7,
  engaged: 0,
  unknown: 0,
};

function buildCosperRequestImplementation(input: unknown): CosperBuildResult {
  const client = parseInput(canonicalClientSchema, input);

  const address = selectAddress(client.addresses);

  const email = selectEmail(client.contact_details);

  const phone = selectPhone(client.contact_details);

  const warnings: CosperWarning[] = [];

  if (client.marital_status === 'engaged') {
    warnings.push({
      code: 'MARITAL_STATUS_UNREPRESENTABLE',
      path: ['marital_status'],
      message: 'Cosper has no engaged status; encoded as 0',
    });
  }

  if (client.marital_status === 'unknown') {
    warnings.push({
      code: 'MARITAL_STATUS_UNKNOWN',
      path: ['marital_status'],
      message: 'Marital status is unknown; encoded as Cosper code 0',
    });
  }

  if (client.legal_sex === null) {
    warnings.push({
      code: 'LEGAL_SEX_DEFAULTED',
      path: ['legal_sex'],
      message: 'Legal sex is absent; encoded as Cosper code 2',
    });
  }

  const request: CosperRequest = {
    ClientRef: client.id,
    Forename: client.first_name,
    Surname: client.last_name,
    DateOfBirth:
      client.date_of_birth === null
        ? null
        : toDayMonthYear(client.date_of_birth),
    Sex:
      client.legal_sex === 'male' ? 0 : client.legal_sex === 'female' ? 1 : 2,
    MaritalStatus:
      maritalCodes[client.marital_status] ??
      throwInvariant(`Unknown marital status: ${client.marital_status}`),
    AddressLine1: address?.line1 ?? null,
    AddressLine2: address?.line2 ?? null,
    Town: address?.town_city ?? null,
    Postcode: address?.postcode ?? null,
    Country: countryName(address?.country ?? null),
    Email: email?.value ?? null,
    Telephone: formatCosperPhone(phone?.value ?? null),
  };

  let validated: CosperRequest;

  try {
    validated = cosperRequestSchema.parse(request);
  } catch (error) {
    if (error instanceof InputValidationError) {
      throw new InvalidBuildResultError(
        `Invalid Cosper request: ${error.issues.map((issue) => issue.message).join('; ')}`,
      );
    }

    throw error;
  }

  return {
    request: validated,
    response: { simulated: true, status: 'created', clientRef: client.id },
    warnings,
  };
}

export class CosperAdapter {
  buildRequest(input: unknown): CosperBuildResult {
    return buildCosperRequestImplementation(input);
  }
}

const defaultCosperAdapter = new CosperAdapter();

export const buildCosperRequest =
  defaultCosperAdapter.buildRequest.bind(defaultCosperAdapter);
