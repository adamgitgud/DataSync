import type { BuildRequestResult } from './clients.interfaces';
import type { CosperRequest } from '../integrations/cosper/cosper.schema';
import { describe, expect, it } from 'vitest';
import { ClientsService } from './clients.service';
import { asHttpError } from '../common/errors/http.error';
import { OperationNotSupportedError } from '../common/errors/domain.error';
import { minimalClient } from '../testing/factories';
import { createDependencies } from '../app.dependencies';
import { acornClientSchema } from '../integrations/acorn/acorn.schema';

describe('ClientsService', () => {
  it('lists and dispatches through an injected provider port', async () => {
    const calls: unknown[] = [];
    const stubClientRef = 'x';

    const cosperCapability = {
      name: 'cosper',
      operations: {
        'build-request': {
          execute: (input: unknown): BuildRequestResult<CosperRequest> => {
            calls.push(input);

            return {
              request: {
                ClientRef: stubClientRef,
                Forename: null,
                Surname: null,
                DateOfBirth: null,
                Sex: 2,
                MaritalStatus: 0,
                AddressLine1: null,
                AddressLine2: null,
                Town: null,
                Postcode: null,
                Country: null,
                Email: null,
                Telephone: null,
              },
              response: { simulated: true },
              warnings: [],
            };
          },
        },
      },
    } as const;

    const service = new ClientsService({
      list: () => [{ slug: 'cosper', supports: ['build-request'] }],
      find: (name) => (name === 'cosper' ? cosperCapability : undefined),
      findOperation: (name, operation) =>
        name === 'cosper' && operation === 'build-request'
          ? {
              provider: cosperCapability,
              definition: cosperCapability.operations['build-request'],
            }
          : undefined,
    });

    expect(service.listProviders()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
    const expectedRequest: Pick<CosperRequest, 'ClientRef'> = {
      ClientRef: stubClientRef,
    };
    const stubInput = { note: 'payload' };

    await expect(
      service.buildRequest('cosper', stubInput),
    ).resolves.toMatchObject({
      request: expectedRequest,
    });
    expect(calls).toEqual([stubInput]);
  });

  it('supports zero-argument construction', async () => {
    const service = new ClientsService(createDependencies().providerRegistry);
    expect(service.listProviders().map((item) => item.slug)).toEqual([
      'acorn',
      'beacon',
      'cosper',
    ]);
    const acornInput = acornClientSchema.parse({ id: 1 });

    await expect(service.normalise('acorn', acornInput)).resolves.toMatchObject(
      {
        id: acornInput.id,
      },
    );
    const defaultClient = minimalClient();

    expect(
      (await service.buildRequest('cosper', defaultClient)).request[
        'ClientRef'
      ],
    ).toBe(defaultClient.id);
  });

  it('rejects missing or unsupported operations through the public methods', async () => {
    const service = new ClientsService({
      list: () => [],
      find: () => undefined,
      findOperation: () => undefined,
    });
    const emptyInput: Record<string, never> = {};

    await expect(
      service.normalise('missing', emptyInput),
    ).rejects.toBeInstanceOf(OperationNotSupportedError);

    const emptyInput2: Record<string, never> = {};

    const missingError = await service
      .buildRequest('missing', emptyInput2)
      .catch((cause: unknown) => cause);

    expect(missingError).toBeInstanceOf(OperationNotSupportedError);
    expect(asHttpError(missingError)).toMatchObject({
      status: 400,
      code: 'OPERATION_NOT_SUPPORTED',
    });
  });

  it('trusts adapter output without re-validating (edge owns validation)', async () => {
    const acornCapability = {
      name: 'acorn',
      operations: {
        normalise: {
          execute: () => minimalClient({ id: '' }),
        },
      },
    } as const;

    const service = new ClientsService({
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

    await expect(
      service.normalise('acorn', acornClientSchema.parse({ id: 1 })),
    ).resolves.toMatchObject({ id: '' });
  });
});
