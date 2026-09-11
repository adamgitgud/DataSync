import {
  asHttpError,
  HttpError,
  type ErrorBody,
} from '../common/errors/http.error';
import type { DependencyVariables } from '../common/middleware/dependencies.middleware';
import type { Hono } from 'hono';

function errorResponse(error: HttpError): Response {
  const body: ErrorBody = {
    error: { code: error.code, message: error.message },
  };

  if (error.issues !== undefined) {
    body.error.issues = error.issues;
  }

  return Response.json(body, { status: error.status });
}

export function registerErrorHandling(
  app: Hono<{ Variables: DependencyVariables }>,
) {
  app.onError((error, context) => {
    const httpError = asHttpError(error);

    if (httpError.status === 500) {
      context.get('dependencies').logger.error('Unexpected ZeroKey error', {
        path: context.req.path,
        method: context.req.method,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
    }

    return errorResponse(httpError);
  });
  app.notFound(() =>
    errorResponse(new HttpError(404, 'NOT_FOUND', 'Route not found')),
  );
}
