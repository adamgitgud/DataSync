import type { BuildRequestResult } from './clients.interfaces';
import type { CosperRequest } from '../integrations/cosper/cosper.schema';
import type { AcornPayload } from '../testing/payloads';
import { describe, expect, it } from 'vitest';
import { ClientsService } from './clients.service';
import { HttpError, asHttpError } from '../common/errors/http.error';
import { OperationNotSupportedError } from '../common/errors/domain.error';
import { InputValidationError } from '../common/validation/input-validation';
import { minimalClient } from '../testing/factories';
import { createDependencies } from '../app.dependencies';

describe('ClientsService', () => {
  it('lists and dispatches through an injected provider port', async () => {
    const calls: string[] = [];
    const stubClientRef = 'x';

    const service = new ClientsService({
      list: () => [{ slug: 'cosper', supports: ['build-request'] }],
      find: (name) =>
        name === 'cosper'
          ? {
              name: 'cosper',
              operations: {
                'build-request': {
                  execute: (input): BuildRequestResult<CosperRequest> => {
                    calls.push(String(input));

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
            }
          : undefined,
    });

    expect(service.listProviders()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
    const expectedRequest: Pick<CosperRequest, 'ClientRef'> = {
      ClientRef: stubClientRef,
    };

    await expect(
      service.buildRequest('cosper', 'payload'),
    ).resolves.toMatchObject({
      request: expectedRequest,
    });
    expect(calls).toEqual(['payload']);
  });

  it('supports zero-argument construction', async () => {
    const service = new ClientsService(createDependencies().providerRegistry);
    expect(service.listProviders().map((item) => item.slug)).toEqual([
      'acorn',
      'beacon',
      'cosper',
    ]);
    const acornInput: AcornPayload = { id: 1 };

    await expect(service.normalise('acorn', acornInput)).resolves.toMatchObject(
      {
        id: String(acornInput.id).trim(),
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

  it('surfaces invalid canonical output as a validation error', async () => {
    const service = new ClientsService({
      list: () => [{ slug: 'acorn', supports: ['normalise'] }],
      find: (name) =>
        name === 'acorn'
          ? {
              name: 'acorn',
              operations: {
                normalise: {
                  execute: () => ({ id: '' }),
                },
              },
            }
          : undefined,
    });

    const error = await service
      .normalise('acorn', { id: 1 })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(InputValidationError);
    expect(asHttpError(error)).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
    });
    expect(error).not.toBeInstanceOf(HttpError);
  });
});
