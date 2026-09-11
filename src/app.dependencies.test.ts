import type { ClientsServicePort } from './clients/clients.interfaces';
import { describe, expect, it } from 'vitest';
import { ClientsController } from './clients/clients.controller';
import { createDependencies } from './app.dependencies';
import { minimalClient } from './testing/factories';

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

  it('wires lower-level overrides into default services', () => {
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
    expect(dependencies.clientsController.providers()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
  });

  it('honors explicit service and controller replacements', () => {
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
    const clientsController = new ClientsController(clientsService);

    const dependencies = createDependencies({
      clientsService,
      clientsController,
    });

    expect(dependencies.clientsService).toBe(clientsService);
    expect(dependencies.clientsController).toBe(clientsController);
    expect(dependencies.clientsController.providers()).toEqual([
      { slug: 'acorn', supports: ['normalise'] },
    ]);
  });
});
