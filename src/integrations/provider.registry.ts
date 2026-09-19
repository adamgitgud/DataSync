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
          execute: acornAdapter.normalise.bind(acornAdapter),
          bodySchema: acornClientSchema,
          documentation: {
            requestSchema: 'AcornClient',
            responseSchema: 'CanonicalClient',
            summary: 'Normalise an Acorn client payload',
            description:
              'Validates raw Acorn JSON, then returns the canonical Client projection.',
            requestExample: acornExample,
          },
        },
      },
    },
    {
      name: 'beacon',
      operations: {
        normalise: {
          execute: beaconAdapter.normalise.bind(beaconAdapter),
          bodySchema: beaconClientSchema,
          documentation: {
            requestSchema: 'BeaconClient',
            responseSchema: 'CanonicalClient',
            summary: 'Normalise a Beacon client payload',
            description:
              'Validates raw Beacon JSON, then returns the canonical Client projection.',
            requestExample: beaconExample,
          },
        },
      },
    },
    {
      name: 'cosper',
      operations: {
        'build-request': {
          execute: cosperAdapter.buildRequest.bind(cosperAdapter),
          bodySchema: canonicalClientSchema,
          formatResult: (
            provider: string,
            result: CosperBuildResult,
          ): ProviderBuildResponse<CosperBuildResult> => ({
            provider,
            ...result,
          }),
          documentation: {
            requestSchema: 'CanonicalClient',
            responseSchema: 'SimulatedCosperResponse',
            summary: 'Build a simulated Cosper request',
            description:
              'Cosper creation is simulated; no outbound provider call is made.',
            requestExample: cosperExample,
          },
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

  return { provider, definition };
}

export function providerCapabilities(
  entries: readonly ProviderCapabilityPort[] = createBuiltInRegistry(),
): ProviderCapabilitySummary[] {
  return entries.map((entry) => ({
    slug: entry.name,
    supports: Object.keys(entry.operations),
  }));
}
