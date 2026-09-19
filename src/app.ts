import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  createDependencies,
  type DependencyOverrides,
} from './app.dependencies';
import {
  dependencyMiddleware,
  type DependencyVariables,
} from './common/middleware/dependencies.middleware';
import { operationDocumentation, registerOpenApiRoutes } from './docs/openapi';
import { registerErrorHandling } from './http/error-handler';
import { registerProviderRoutes } from './http/provider.routes';

export function createApp(dependencies: DependencyOverrides = {}) {
  const graph = createDependencies(dependencies);
  const capabilities = graph.providerRegistry.list();

  const app = new Hono<{ Variables: DependencyVariables }>();

  app.use('*', dependencyMiddleware(graph));
  app.use('/v1/*', bodyLimit({ maxSize: 100 * 1024 }));

  app.get('/health', (context) => context.json({ status: 'ok' }));

  registerErrorHandling(app);

  registerProviderRoutes(app, graph.clientsController);

  registerOpenApiRoutes(
    app,
    capabilities,
    operationDocumentation(graph.providerRegistry, capabilities),
  );

  return app;
}

export const app = createApp();
