import type { Hono } from 'hono';
import type { ClientsControllerPort } from '../clients/clients.interfaces';
import type { DependencyVariables } from '../common/middleware/dependencies.middleware';

export function registerProviderRoutes(
  app: Hono<{ Variables: DependencyVariables }>,
  clientsController: ClientsControllerPort,
) {
  app.get('/v1/providers', clientsController.listProviders);
  app.post(
    '/v1/:provider/clients/:operation',
    clientsController.executeOperation,
  );
}
