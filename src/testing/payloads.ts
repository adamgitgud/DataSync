import type {
  AcornClient,
  AcornClientReference,
} from '../integrations/acorn/acorn.schema';
import type { BeaconClient } from '../integrations/beacon/beacon.schema';

type DeepPartial<SourceValue> = SourceValue extends readonly (infer Item)[]
  ? DeepPartial<Item>[] | null
  : SourceValue extends object
    ? {
        [Key in keyof SourceValue]?: DeepPartial<SourceValue[Key]> | undefined;
      }
    : SourceValue;

export type AcornPayload = Omit<DeepPartial<AcornClient>, 'id'> &
  AcornClientReference;

type BeaconAddress = NonNullable<BeaconClient['addresses']>[number];

interface BeaconBagEntry<TValue> {
  key: string;
  value?: TValue | undefined;
}

type BeaconAddressPayload = Omit<DeepPartial<BeaconAddress>, 'primary'> & {
  primary?: boolean | string | undefined;
};

export type BeaconPayload<TValue = string | null> = Omit<
  DeepPartial<BeaconClient>,
  'recordId' | 'attributes' | 'formattedValues' | 'addresses'
> &
  Pick<BeaconClient, 'recordId'> & {
    addresses?: BeaconAddressPayload[] | null | undefined;
    attributes?: BeaconBagEntry<TValue>[] | null | undefined;
    formattedValues?: BeaconBagEntry<TValue>[] | null | undefined;
  };

export type FixtureValue =
  string | number | boolean | null | undefined | FixtureValue[] | FixtureObject;

interface FixtureObject {
  [key: string]: FixtureValue;
}

export type MalformedAcornPayload = Partial<
  Record<keyof AcornPayload, FixtureValue>
> &
  FixtureObject;

export type MalformedBeaconPayload = Partial<
  Record<keyof BeaconPayload, FixtureValue>
> &
  FixtureObject;

export type WithAdditionalFields<FieldValue> =
  FieldValue extends readonly (infer Item)[]
    ? WithAdditionalFields<Item>[]
    : FieldValue extends object
      ? {
          [Key in keyof FieldValue]: WithAdditionalFields<FieldValue[Key]>;
        } & FixtureObject
      : FieldValue;
