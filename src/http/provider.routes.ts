import type { Hono } from 'hono';
import { HttpError } from '../common/errors/http.error';
import { providerOperation } from '../clients/clients.interfaces';
import type { DependencyVariables } from '../common/middleware/dependencies.middleware';

export function registerProviderRoutes(
  app: Hono<{ Variables: DependencyVariables }>,
) {
  app.get('/v1/providers', (context) =>
    context.json(context.get('dependencies').clientsController.providers()),
  );

  app.post('/v1/:provider/clients/:operation', async (context) => {
    const dependencies = context.get('dependencies');

    const providerParam = context.req.param('provider');
    const operation = context.req.param('operation');

    const provider = dependencies.providerRegistry.find(providerParam);

    if (provider === undefined) {
      throw new HttpError(404, 'PROVIDER_NOT_FOUND', 'Provider not found');
    }

    if (providerOperation(provider, operation) === undefined) {
      throw new HttpError(
        400,
        'OPERATION_NOT_SUPPORTED',
        `Provider ${provider.name} does not support ${operation}`,
      );
    }

    const result = await dependencies.clientsController.operation(
      provider.name,
      operation,
      context.req.raw,
    );

    return context.json(result);
  });
}
