import { InputValidationError } from '../validation/input-validation';
import {
  InvalidBuildResultError,
  OperationNotSupportedError,
} from './domain.error';

export type ErrorCode =
  | 'PROVIDER_NOT_FOUND'
  | 'OPERATION_NOT_SUPPORTED'
  | 'INVALID_JSON'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    issues?: { path: (string | number)[]; message: string }[];
  };
}

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 413 | 422 | 500,
    readonly code: ErrorCode,
    message: string,
    readonly issues?: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
  }
}

function statusFromError(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;

  return typeof status === 'number' ? status : undefined;
}

export function asHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) {
    return error;
  }

  if (error instanceof InputValidationError) {
    return new HttpError(
      422,
      'VALIDATION_ERROR',
      'Invalid request payload',
      error.issues,
    );
  }

  if (error instanceof OperationNotSupportedError) {
    return new HttpError(400, 'OPERATION_NOT_SUPPORTED', error.message);
  }

  if (error instanceof InvalidBuildResultError) {
    return new HttpError(500, 'INTERNAL_ERROR', 'Internal server error');
  }

  if (statusFromError(error) === 413) {
    return new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
  }

  return new HttpError(500, 'INTERNAL_ERROR', 'Internal server error');
}
