import type { AcornPayload, BeaconPayload } from '../testing/payloads';
import { describe, expect, it } from 'vitest';
import { throwInvariant } from '../common/errors/invariant';
import { AcornAdapter } from './acorn/acorn.adapter';
import { BeaconAdapter } from './beacon/beacon.adapter';
import { CosperAdapter } from './cosper/cosper.adapter';
import { minimalClient } from '../testing/factories';
import {
  createBuiltInRegistry,
  findProvider,
  providerCapabilities,
} from './provider.registry';

describe('provider registry', () => {
  it('resolves registered providers and returns independent capability data', () => {
    const registry = createBuiltInRegistry();

    expect(findProvider('acorn', registry)?.name).toBe('acorn');
    expect(findProvider('missing', registry)).toBeUndefined();
    const capabilities = providerCapabilities(registry);
    expect(capabilities).toEqual([
      { slug: 'acorn', supports: ['normalise'] },
      { slug: 'beacon', supports: ['normalise'] },
      { slug: 'cosper', supports: ['build-request'] },
    ]);
    const fresh = providerCapabilities(createBuiltInRegistry());
    const firstCapability =
      capabilities[0] ?? throwInvariant('Missing capability');
    const freshCapability =
      fresh[0] ?? throwInvariant('Missing fresh capability');
    expect(firstCapability).not.toBe(freshCapability);
    expect(firstCapability.supports).not.toBe(freshCapability.supports);
  });

  it('builds an isolated registry per call', () => {
    const first = createBuiltInRegistry();
    const second = createBuiltInRegistry();

    expect(first).not.toBe(second);
    expect(first.map((entry) => entry.name)).toEqual(
      second.map((entry) => entry.name),
    );
  });

  it('exposes class-based capability adapters with explicit methods', () => {
    const acornInput: AcornPayload = { id: 7 };

    expect(new AcornAdapter().normalise(acornInput).id).toBe(
      String(acornInput.id).trim(),
    );
    const beaconInput: BeaconPayload = { recordId: 'b-1' };

    expect(new BeaconAdapter().normalise(beaconInput).id).toBe(
      beaconInput.recordId.trim(),
    );
    const defaultClient = minimalClient();

    expect(
      new CosperAdapter().buildRequest(defaultClient).request.ClientRef,
    ).toBe(defaultClient.id);
  });
});
