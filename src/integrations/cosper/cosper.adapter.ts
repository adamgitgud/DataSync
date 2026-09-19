import {
  type CanonicalClient,
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
import { throwInvariant } from '../../common/errors/invariant';
import {
  type CosperBuildResult,
  type CosperRequest,
  type CosperWarning,
} from './cosper.schema';

const maritalCodes: Record<MaritalStatus, CosperRequest['MaritalStatus']> = {
  'civil-partner': 4,
  cohabiting: 3,
  divorced: 6,
  engaged: 0,
  married: 2,
  separated: 5,
  single: 1,
  unknown: 0,
  widowed: 7,
};

function buildCosperRequestImplementation(
  client: CanonicalClient,
): CosperBuildResult {
  const address = selectAddress(client.addresses);

  const email = selectEmail(client.contact_details);

  const phone = selectPhone(client.contact_details);

  const warnings: CosperWarning[] = [];

  if (client.marital_status === 'engaged') {
    warnings.push({
      code: 'MARITAL_STATUS_UNREPRESENTABLE',
      message: 'Cosper has no engaged status; encoded as 0',
      path: ['marital_status'],
    });
  }

  if (client.marital_status === 'unknown') {
    warnings.push({
      code: 'MARITAL_STATUS_UNKNOWN',
      message: 'Marital status is unknown; encoded as Cosper code 0',
      path: ['marital_status'],
    });
  }

  if (client.legal_sex === null) {
    warnings.push({
      code: 'LEGAL_SEX_DEFAULTED',
      message: 'Legal sex is absent; encoded as Cosper code 2',
      path: ['legal_sex'],
    });
  }

  const request: CosperRequest = {
    AddressLine1: address?.line1 ?? null,
    AddressLine2: address?.line2 ?? null,
    ClientRef: client.id,
    Country: countryName(address?.country ?? null),
    DateOfBirth:
      client.date_of_birth === null
        ? null
        : toDayMonthYear(client.date_of_birth),
    Email: email?.value ?? null,
    Forename: client.first_name,
    MaritalStatus:
      maritalCodes[client.marital_status] ??
      throwInvariant(`Unknown marital status: ${client.marital_status}`),
    Postcode: address?.postcode ?? null,
    Sex:
      client.legal_sex === 'male' ? 0 : client.legal_sex === 'female' ? 1 : 2,
    Surname: client.last_name,
    Telephone: formatCosperPhone(phone?.value ?? null),
    Town: address?.town_city ?? null,
  };

  return {
    request,
    response: { clientRef: client.id, simulated: true, status: 'created' },
    warnings,
  };
}

export class CosperAdapter {
  buildRequest(client: CanonicalClient): CosperBuildResult {
    return buildCosperRequestImplementation(client);
  }
}

const defaultCosperAdapter = new CosperAdapter();

export const buildCosperRequest =
  defaultCosperAdapter.buildRequest.bind(defaultCosperAdapter);
