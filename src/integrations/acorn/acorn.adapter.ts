import {
  type CanonicalAddress,
  type CanonicalClient,
  type CanonicalContactDetail,
} from '../../clients/schemas/canonical-client.schema';
import {
  mapAcornMaritalStatus,
  mapAcornSex,
} from '../../common/normalisation/enums';
import {
  acornNationality,
  normaliseCountry,
} from '../../common/normalisation/countries';
import {
  mapContacts,
  toCanonicalContact,
} from '../../common/normalisation/contacts';
import {
  fullName,
  normaliseNi,
  normalisePostcode,
} from '../../common/normalisation/text';
import { type AcornClient } from './acorn.schema';

const channels = new Map<string, CanonicalContactDetail['type']>([
  ['emailaddress', 'email'],
  ['mobilephone', 'mobile'],
  ['landline', 'telephone'],
]);

function mapAddress(
  source: AcornClient['addresses'][number],
): CanonicalAddress {
  const { buildingName, locality, street } = source;

  return {
    country: normaliseCountry(source.countryName),
    county: source.region,
    line1: buildingName ?? street ?? locality,
    line2: buildingName
      ? [street, locality].filter((part) => part !== null).join(', ') || null
      : street
        ? locality
        : null,
    move_in_date: source.movedIn,
    postcode: normalisePostcode(source.postcode),
    primary: source.isPrimary,
    town_city: source.town,
  };
}

function normaliseAcornImplementation(source: AcornClient): CanonicalClient {
  const { person } = source;
  const contacts = mapContacts(source.contactPoints, (point) =>
    toCanonicalContact(
      channels.get(point.channel?.toLowerCase() ?? '') ?? 'other',
      point.detail,
      point.preferred,
    ),
  );

  const client: CanonicalClient = {
    addresses: source.addresses.map(mapAddress),
    contact_details: contacts,
    date_of_birth: person?.dateOfBirth ?? null,
    first_name: person?.firstName ?? null,
    full_name: fullName(
      person?.firstName,
      person?.middleName,
      person?.lastName,
    ),
    id: source.id,
    last_name: person?.lastName ?? null,
    legal_sex: mapAcornSex(person?.gender),
    marital_status: mapAcornMaritalStatus(person?.maritalStatus),
    middle_names: person?.middleName ?? null,
    nationality: acornNationality(
      person?.nationalityCountry?.isoCode,
      person?.nationalityCountry?.name,
    ),
    ni_number: normaliseNi(person?.niNumber),
    title: person?.title ?? null,
  };

  return client;
}

export class AcornAdapter {
  normalise(source: AcornClient): CanonicalClient {
    return normaliseAcornImplementation(source);
  }
}

const defaultAcornAdapter = new AcornAdapter();

export const normaliseAcorn =
  defaultAcornAdapter.normalise.bind(defaultAcornAdapter);
