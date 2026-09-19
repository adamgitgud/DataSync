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
      provider: context.req.param('provider') ?? '',
      operation: context.req.param('operation') ?? '',
    });

    const resolved = this.providerRegistry.findOperation(
      params.provider,
      params.operation,
    );

    if (resolved === undefined) {
      if (this.providerRegistry.find(params.provider) === undefined) {
        throw new HttpError(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
      }

      throw new HttpError(
        400,
        'OPERATION_NOT_SUPPORTED',
        `Provider ${params.provider} does not support ${params.operation}`,
      );
    }

    const rawBody = await parseJsonBody(context);

    const validated = validateProviderRequest(
      resolved.definition,
      params,
      context.req.query(),
      rawBody,
    );

    const result = await this.clientsService.execute(
      resolved.provider.name,
      params.operation,
      validated.body,
      validated.query,
    );

    return context.json(result);
  };
}
