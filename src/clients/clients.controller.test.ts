import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { ClientsController } from './clients.controller';
import type {
  ClientsServicePort,
  ProviderRegistryPort,
} from './clients.interfaces';
import { createDependencies } from '../app.dependencies';
import { HttpError } from '../common/errors/http.error';
import { minimalClient } from '../testing/factories';

function createTestApp(controller: ClientsController) {
  const testApp = new Hono();

  testApp.get('/v1/providers', controller.listProviders);
  testApp.post('/v1/:provider/clients/:operation', controller.executeOperation);
  testApp.onError((error) => {
    if (error instanceof HttpError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }

    throw error;
  });

  return testApp;
}

describe('ClientsController', () => {
  it('serializes provider listing and delegates parsed input', async () => {
    const seen: unknown[] = [];
    const stubId = 'x';

    const clientsService: ClientsServicePort = {
      buildRequest: (provider, input) => {
        seen.push([provider, input]);

        return {
          request: { ClientRef: String((input as { id: string }).id) },
          response: { clientRef: stubId, simulated: true, status: 'created' },
          warnings: [],
        };
      },
      execute: (args) => {
        seen.push([args.provider, args.operation, args.input]);

        if (args.operation === 'normalise') {
          return minimalClient({ id: stubId });
        }

        return {
          provider: args.provider,
          request: { ClientRef: String((args.input as { id: string }).id) },
          response: { clientRef: stubId, simulated: true, status: 'created' },
          warnings: [],
        };
      },
      listProviders: () => [{ slug: 'cosper', supports: ['build-request'] }],
      normalise: (provider, input) => {
        seen.push([provider, input]);

        return minimalClient({ id: stubId });
      },
    };

    const cosperCapability = {
      name: 'cosper',
      operations: { 'build-request': { execute: () => ({}) } },
    } as const;
    const acornCapability = {
      name: 'acorn',
      operations: { normalise: { execute: () => ({}) } },
    } as const;

    const providerRegistry: ProviderRegistryPort = {
      find: (name) => {
        if (name === 'cosper') {
          return cosperCapability;
        }

        if (name === 'acorn') {
          return acornCapability;
        }

        return undefined;
      },
      findOperation: (name, operation) => {
        if (name === 'cosper' && operation === 'build-request') {
          return {
            definition: cosperCapability.operations['build-request'],
            provider: cosperCapability,
          };
        }

        if (name === 'acorn' && operation === 'normalise') {
          return {
            definition: acornCapability.operations.normalise,
            provider: acornCapability,
          };
        }

        return undefined;
      },
      list: () => [{ slug: 'cosper', supports: ['build-request'] }],
    };

    const controller = new ClientsController(clientsService, providerRegistry);
    const testApp = createTestApp(controller);

    const providersResponse = await testApp.request('/v1/providers');

    expect(providersResponse.status).toBe(200);
    expect(await providersResponse.json()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);

    const resultResponse = await testApp.request(
      '/v1/cosper/clients/build-request',
      {
        body: `{"id":"${stubId}"}`,
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(resultResponse.status).toBe(200);
    expect(await resultResponse.json()).toEqual({
      provider: 'cosper',
      request: { ClientRef: stubId },
      response: { clientRef: stubId, simulated: true, status: 'created' },
      warnings: [],
    });
    expect(seen).toEqual([['cosper', 'build-request', { id: stubId }]]);

    const normaliseResponse = await testApp.request(
      '/v1/acorn/clients/normalise',
      {
        body: `{"id":"${stubId}"}`,
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      },
    );

    expect(normaliseResponse.status).toBe(200);
    expect(await normaliseResponse.json()).toEqual(
      minimalClient({ id: stubId }),
    );
    expect(seen).toEqual([
      ['cosper', 'build-request', { id: stubId }],
      ['acorn', 'normalise', { id: stubId }],
    ]);
  });

  it('works with the composition-root service wiring', async () => {
    const dependencies = createDependencies();
    const testApp = createTestApp(
      dependencies.clientsController as ClientsController,
    );

    const response = await testApp.request('/v1/providers');

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(3);
  });
});
