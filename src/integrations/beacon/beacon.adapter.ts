import {
  type CanonicalClient,
  type CanonicalContactDetail,
} from '../../clients/schemas/canonical-client.schema';
import {
  mapBeaconMaritalStatus,
  mapBeaconSex,
} from '../../common/normalisation/enums';
import {
  normaliseCountry,
  normaliseNationality,
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
import { type BeaconClient } from './beacon.schema';

const channels = new Map<number, CanonicalContactDetail['type']>([
  [1, 'email'],
  [2, 'mobile'],
  [3, 'telephone'],
]);

function normaliseBeaconImplementation(source: BeaconClient): CanonicalClient {
  const { attributes } = source;

  const formatted = source.formattedValues;

  const first = attributes.get('firstname') ?? null;
  const middle = attributes.get('middlename') ?? null;
  const last = attributes.get('lastname') ?? null;
  const contacts = mapContacts(source.contacts, (point) =>
    toCanonicalContact(
      point.type == null ? 'other' : (channels.get(point.type) ?? 'other'),
      point.value,
      point.isPrimary,
    ),
  );

  const client: CanonicalClient = {
    addresses: source.addresses.map((item) => ({
      country: normaliseCountry(item.country),
      county: item.county,
      line1: item.line1,
      line2: item.line2,
      move_in_date: null,
      postcode: normalisePostcode(item.postcode),
      primary: item.primary,
      town_city: item.city,
    })),
    contact_details: contacts,
    date_of_birth: attributes.get('birthdate') ?? null,
    first_name: first,
    full_name: fullName(first, middle, last),
    id: source.recordId,
    last_name: last,
    legal_sex: mapBeaconSex(formatted.get('gendercode')),
    marital_status: mapBeaconMaritalStatus(formatted.get('familystatuscode')),
    middle_names: middle,
    nationality: normaliseNationality(attributes.get('t4a_nationality')),
    ni_number: normaliseNi(attributes.get('t4a_ninumber')),
    title: formatted.get('title') ?? null,
  };

  return client;
}

export class BeaconAdapter {
  normalise(source: BeaconClient): CanonicalClient {
    return normaliseBeaconImplementation(source);
  }
}

const defaultBeaconAdapter = new BeaconAdapter();

export const normaliseBeacon =
  defaultBeaconAdapter.normalise.bind(defaultBeaconAdapter);
