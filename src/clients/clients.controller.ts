import type {
  ClientsControllerPort,
  ClientsServicePort,
  ProviderRegistryPort,
} from './clients.interfaces';
import { HttpError } from '../common/errors/http.error';
import { parseInput } from '../common/validation/input-validation';
import {
  parseJsonBody,
  providerParamsSchema,
  validateProviderRequest,
} from '../common/validation/request-validation';

export class ClientsController implements ClientsControllerPort {
  constructor(
    private readonly clientsService: ClientsServicePort,
    private readonly providerRegistry: ProviderRegistryPort,
  ) {}

  readonly listProviders: ClientsControllerPort['listProviders'] = (context) =>
    context.json(this.clientsService.listProviders());

  readonly executeOperation: ClientsControllerPort['executeOperation'] = async (
    context,
  ) => {
    const params = parseInput(providerParamsSchema, {
      operation: context.req.param('operation') ?? '',
      provider: context.req.param('provider') ?? '',
    });

    const resolved = this.providerRegistry.findOperation(
      params.provider,
      params.operation,
    );

    if (resolved === undefined) {
      if (this.providerRegistry.find(params.provider) === undefined) {
        throw new HttpError({
          code: 'PROVIDER_NOT_FOUND',
          message: 'Provider not found',
          status: 404,
        });
      }

      throw new HttpError({
        code: 'OPERATION_NOT_SUPPORTED',
        message: `Provider ${params.provider} does not support ${params.operation}`,
        status: 400,
      });
    }

    const rawBody = await parseJsonBody(context);

    const validated = validateProviderRequest(resolved.definition, params, {
      body: rawBody,
      query: context.req.query(),
    });

    const result = await this.clientsService.execute({
      input: validated.body,
      operation: params.operation,
      provider: resolved.provider.name,
      query: validated.query,
    });

    return context.json(result);
  };
}
