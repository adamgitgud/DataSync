import type {
  LegalSex,
  MaritalStatus,
} from '../../clients/schemas/canonical-client.schema';

const acornSexes = new Map<string, LegalSex>([
  ['male', 'male'],
  ['female', 'female'],
  ['unspecified', 'unspecified'],
]);

const beaconSexes = new Map<string, LegalSex>([
  ['male', 'male'],
  ['female', 'female'],
  ['non-binary', 'other'],
  ['unspecified', 'unspecified'],
]);

const acornMaritalStatuses = new Map<string, MaritalStatus>([
  ['single', 'single'],
  ['married', 'married'],
  ['civil partner', 'civil-partner'],
  ['living together', 'cohabiting'],
  ['engaged', 'engaged'],
  ['separated', 'separated'],
  ['divorced', 'divorced'],
  ['widowed', 'widowed'],
  ['unknown', 'unknown'],
]);

const beaconMaritalStatuses = new Map<string, MaritalStatus>([
  ['single', 'single'],
  ['married', 'married'],
  ['civil partnership', 'civil-partner'],
  ['cohabiting', 'cohabiting'],
  ['intend to marry', 'engaged'],
  ['separated', 'separated'],
  ['divorced', 'divorced'],
  ['widowed', 'widowed'],
  ['unknown', 'unknown'],
]);

function normaliseKey(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

export function mapAcornSex(value: string | null | undefined): LegalSex | null {
  return acornSexes.get(normaliseKey(value)) ?? null;
}

export function mapBeaconSex(
  value: string | null | undefined,
): LegalSex | null {
  return beaconSexes.get(normaliseKey(value)) ?? null;
}

export function mapAcornMaritalStatus(
  value: string | null | undefined,
): MaritalStatus {
  return acornMaritalStatuses.get(normaliseKey(value)) ?? 'unknown';
}

export function mapBeaconMaritalStatus(
  value: string | null | undefined,
): MaritalStatus {
  return beaconMaritalStatuses.get(normaliseKey(value)) ?? 'unknown';
}
