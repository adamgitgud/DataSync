import { describe, expect, it } from 'vitest';
import { ClientsController } from './clients.controller';
import { createDependencies } from '../app.dependencies';
import { minimalClient } from '../testing/factories';

describe('ClientsController', () => {
  it('serializes provider listing and delegates parsed input', async () => {
    const seen: unknown[] = [];
    const stubId = 'x';

    const controller = new ClientsController({
      listProviders: () => [{ slug: 'cosper', supports: ['build-request'] }],
      normalise: async (provider, input) => {
        seen.push([provider, input]);

        return minimalClient({ id: stubId });
      },
      buildRequest: async (provider, input) => {
        seen.push([provider, input]);

        return {
          request: { ClientRef: String((input as { id: string }).id) },
          response: { simulated: true, status: 'created', clientRef: stubId },
          warnings: [],
        };
      },
      execute: async (provider, operation, input) => {
        seen.push([provider, operation, input]);

        if (operation === 'normalise') {
          return minimalClient({ id: stubId });
        }

        return {
          provider,
          request: { ClientRef: String((input as { id: string }).id) },
          response: { simulated: true, status: 'created', clientRef: stubId },
          warnings: [],
        };
      },
    });

    expect(controller.providers()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
    const result = await controller.operation(
      'cosper',
      'build-request',
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: `{"id":"${stubId}"}`,
      }),
    );

    expect(result).toEqual({
      provider: 'cosper',
      request: { ClientRef: stubId },
      response: { simulated: true, status: 'created', clientRef: stubId },
      warnings: [],
    });
    expect(seen).toEqual([['cosper', 'build-request', { id: stubId }]]);
    expect(
      await controller.operation(
        'acorn',
        'normalise',
        new Request('http://localhost', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: `{"id":"${stubId}"}`,
        }),
      ),
    ).toEqual(minimalClient({ id: stubId }));
    expect(seen).toEqual([
      ['cosper', 'build-request', { id: stubId }],
      ['acorn', 'normalise', { id: stubId }],
    ]);
  });

  it('works with the composition-root service wiring', () => {
    expect(
      new ClientsController(createDependencies().clientsService).providers(),
    ).toHaveLength(3);
  });
});
