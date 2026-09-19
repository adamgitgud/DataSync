import type {
  ClientsControllerPort,
  ClientsServicePort,
} from './clients/clients.interfaces';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ClientsController } from './clients/clients.controller';
import { createDependencies } from './app.dependencies';
import { minimalClient } from './testing/factories';

async function listProvidersViaHttp(controller: ClientsControllerPort) {
  const testApp = new Hono();

  testApp.get('/v1/providers', controller.listProviders);

  return (await testApp.request('/v1/providers')).json();
}

describe('createDependencies', () => {
  it('constructs a complete default graph', () => {
    const dependencies = createDependencies();

    expect(dependencies.clientsController).toBeInstanceOf(ClientsController);
    expect(dependencies.clientsService.listProviders()).toHaveLength(3);
    expect(dependencies.providerRegistry.find('acorn')?.name).toBe('acorn');
    expect(() =>
      dependencies.logger.error('test error', {
        path: '/test',
        method: 'GET',
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
      listProviders: () => [
        { slug: 'acorn', supports: ['normalise'] as const },
      ],
      normalise: () => minimalClient({ id: stubId }),
      buildRequest: () => ({
        request: { ClientRef: stubId },
        response: { simulated: true as const },
        warnings: [],
      }),
      execute: () => minimalClient({ id: stubId }),
    };
    const acornCapability = {
      name: 'acorn',
      operations: { normalise: { execute: () => ({}) } },
    } as const;
    const clientsController = new ClientsController(clientsService, {
      list: () => [{ slug: 'acorn', supports: ['normalise'] }],
      find: (name) => (name === 'acorn' ? acornCapability : undefined),
      findOperation: (name, operation) =>
        name === 'acorn' && operation === 'normalise'
          ? {
              provider: acornCapability,
              definition: acornCapability.operations.normalise,
            }
          : undefined,
    });

    const dependencies = createDependencies({
      clientsService,
      clientsController,
    });

    expect(dependencies.clientsService).toBe(clientsService);
    expect(dependencies.clientsController).toBe(clientsController);
    expect(await listProvidersViaHttp(dependencies.clientsController)).toEqual([
      { slug: 'acorn', supports: ['normalise'] },
    ]);
  });
});
