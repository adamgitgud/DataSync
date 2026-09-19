import type { AcornClientReference } from './acorn/acorn.schema';
import { acornClientSchema } from './acorn/acorn.schema';
import type { BeaconClient } from './beacon/beacon.schema';
import { beaconClientSchema } from './beacon/beacon.schema';
import {
  canonicalClientSchema,
  createEmptyCanonicalClient,
} from '../clients/schemas/canonical-client.schema';
import type { CosperBuildResult } from './cosper/cosper.schema';
import { AcornAdapter } from './acorn/acorn.adapter';
import { BeaconAdapter } from './beacon/beacon.adapter';
import { CosperAdapter } from './cosper/cosper.adapter';
import type {
  ProviderCapabilitySummary,
  ProviderCapabilityPort,
  ProviderBuildResponse,
  BuiltInProviderCapability,
  ResolvedProviderOperation,
} from '../clients/clients.interfaces';
import { providerOperation } from '../clients/clients.interfaces';

const acornExample: AcornClientReference = { id: 1 };

const beaconExample: Pick<BeaconClient, 'recordId'> = {
  recordId: createEmptyCanonicalClient().id,
};

const cosperExample = createEmptyCanonicalClient();

export function createBuiltInRegistry(): BuiltInProviderCapability[] {
  const acornAdapter = new AcornAdapter();
  const beaconAdapter = new BeaconAdapter();
  const cosperAdapter = new CosperAdapter();

  return [
    {
      name: 'acorn',
      operations: {
        normalise: {
          bodySchema: acornClientSchema,
          documentation: {
            description:
              'Validates raw Acorn JSON, then returns the canonical Client projection.',
            requestExample: acornExample,
            requestSchema: 'AcornClient',
            responseSchema: 'CanonicalClient',
            summary: 'Normalise an Acorn client payload',
          },
          execute: acornAdapter.normalise.bind(acornAdapter),
        },
      },
    },
    {
      name: 'beacon',
      operations: {
        normalise: {
          bodySchema: beaconClientSchema,
          documentation: {
            description:
              'Validates raw Beacon JSON, then returns the canonical Client projection.',
            requestExample: beaconExample,
            requestSchema: 'BeaconClient',
            responseSchema: 'CanonicalClient',
            summary: 'Normalise a Beacon client payload',
          },
          execute: beaconAdapter.normalise.bind(beaconAdapter),
        },
      },
    },
    {
      name: 'cosper',
      operations: {
        'build-request': {
          bodySchema: canonicalClientSchema,
          documentation: {
            description:
              'Cosper creation is simulated; no outbound provider call is made.',
            requestExample: cosperExample,
            requestSchema: 'CanonicalClient',
            responseSchema: 'SimulatedCosperResponse',
            summary: 'Build a simulated Cosper request',
          },
          execute: cosperAdapter.buildRequest.bind(cosperAdapter),
          formatResult: (
            provider: string,
            result: CosperBuildResult,
          ): ProviderBuildResponse<CosperBuildResult> => ({
            provider,
            ...result,
          }),
        },
      },
    },
  ];
}

export function normaliseProviderName(name: string): string {
  return name.toLowerCase().trim();
}

export function findProvider(
  name: string,
  entries: readonly ProviderCapabilityPort[] = createBuiltInRegistry(),
): ProviderCapabilityPort | undefined {
  const normalisedProviderName = normaliseProviderName(name);

  return entries.find(
    (provider) =>
      normaliseProviderName(provider.name) === normalisedProviderName,
  );
}

export function findProviderOperation(
  name: string,
  operation: string,
  entries: readonly ProviderCapabilityPort[] = createBuiltInRegistry(),
): ResolvedProviderOperation | undefined {
  const provider = findProvider(name, entries);

  if (provider === undefined) {
    return undefined;
  }

  const definition = providerOperation(provider, operation);

  if (definition === undefined) {
    return undefined;
  }

  return { definition, provider };
}

export function providerCapabilities(
  entries: readonly ProviderCapabilityPort[] = createBuiltInRegistry(),
): ProviderCapabilitySummary[] {
  return entries.map((entry) => ({
    slug: entry.name,
    supports: Object.keys(entry.operations),
  }));
}
