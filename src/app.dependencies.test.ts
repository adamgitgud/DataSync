import type {
  ClientsControllerPort,
  ClientsServicePort,
} from './clients/clients.interfaces';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ClientsController } from './clients/clients.controller';
import { createDependencies } from './app.dependencies';
import { minimalClient } from './testing/factories';

async function listProvidersViaHttp(
  controller: ClientsControllerPort,
): Promise<unknown> {
  const testApp = new Hono();

  testApp.get('/v1/providers', controller.listProviders);

  return (await testApp.request('/v1/providers')).json() as unknown;
}

describe('createDependencies', () => {
  it('constructs a complete default graph', () => {
    const dependencies = createDependencies();

    expect(dependencies.clientsController).toBeInstanceOf(ClientsController);
    expect(dependencies.clientsService.listProviders()).toHaveLength(3);
    expect(dependencies.providerRegistry.find('acorn')?.name).toBe('acorn');
    expect(() =>
      dependencies.logger.error('test error', {
        method: 'GET',
        path: '/test',
      }),
    ).not.toThrow();
  });

  it('wires lower-level overrides into default services', async () => {
    const dependencies = createDependencies({
      providers: [
        {
          name: 'cosper',
          operations: {
            'build-request': {
              execute: (): Record<string, never> => ({}),
            },
          },
        },
      ],
    });

    expect(dependencies.clientsService.listProviders()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
    expect(await listProvidersViaHttp(dependencies.clientsController)).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
  });

  it('honors explicit service and controller replacements', async () => {
    const stubId = 'fake';
    const clientsService: ClientsServicePort = {
      buildRequest: () => ({
        request: { ClientRef: stubId },
        response: { simulated: true as const },
        warnings: [],
      }),
      execute: () => minimalClient({ id: stubId }),
      listProviders: () => [
        { slug: 'acorn', supports: ['normalise'] as const },
      ],
      normalise: () => minimalClient({ id: stubId }),
    };
    const acornCapability = {
      name: 'acorn',
      operations: { normalise: { execute: () => ({}) } },
    } as const;
    const clientsController = new ClientsController(clientsService, {
      find: (name) => (name === 'acorn' ? acornCapability : undefined),
      findOperation: (name, operation) =>
        name === 'acorn' && operation === 'normalise'
          ? {
              definition: acornCapability.operations.normalise,
              provider: acornCapability,
            }
          : undefined,
      list: () => [{ slug: 'acorn', supports: ['normalise'] }],
    });

    const dependencies = createDependencies({
      clientsController,
      clientsService,
    });

    expect(dependencies.clientsService).toBe(clientsService);
    expect(dependencies.clientsController).toBe(clientsController);
    expect(await listProvidersViaHttp(dependencies.clientsController)).toEqual([
      { slug: 'acorn', supports: ['normalise'] },
    ]);
  });
});
