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
    issues?: { message: string; path: (string | number)[] }[];
    message: string;
  };
}

export interface HttpErrorInit {
  readonly code: ErrorCode;
  readonly issues?: { message: string; path: (string | number)[] }[];
  readonly message: string;
  readonly status: 400 | 404 | 413 | 422 | 500;
}

export class HttpError extends Error {
  readonly code: ErrorCode;

  readonly issues?:
    { message: string; path: (string | number)[] }[] | undefined;

  readonly status: 400 | 404 | 413 | 422 | 500;

  constructor(init: HttpErrorInit) {
    super(init.message);
    this.code = init.code;
    this.issues = init.issues;
    this.status = init.status;
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
    return new HttpError({
      code: 'VALIDATION_ERROR',
      issues: error.issues,
      message: 'Invalid request payload',
      status: 422,
    });
  }

  if (error instanceof OperationNotSupportedError) {
    return new HttpError({
      code: 'OPERATION_NOT_SUPPORTED',
      message: error.message,
      status: 400,
    });
  }

  if (error instanceof InvalidBuildResultError) {
    return new HttpError({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      status: 500,
    });
  }

  if (statusFromError(error) === 413) {
    return new HttpError({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large',
      status: 413,
    });
  }

  return new HttpError({
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    status: 500,
  });
}
