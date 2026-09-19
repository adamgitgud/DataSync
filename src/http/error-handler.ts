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
        error:
          error instanceof Error
            ? { message: error.message, name: error.name, stack: error.stack }
            : error,
        method: context.req.method,
        path: context.req.path,
      });
    }

    return errorResponse(httpError);
  });
  app.notFound(() =>
    errorResponse(
      new HttpError({
        code: 'NOT_FOUND',
        message: 'Route not found',
        status: 404,
      }),
    ),
  );
}
