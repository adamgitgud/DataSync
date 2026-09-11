import type { MiddlewareHandler } from 'hono';
import type { Dependencies } from '../../app.dependencies';

export interface DependencyVariables {
  dependencies: Dependencies;
}

export function dependencyMiddleware(
  dependencies: Dependencies,
): MiddlewareHandler<{ Variables: DependencyVariables }> {
  return async (context, next) => {
    context.set('dependencies', dependencies);
    await next();
  };
}
