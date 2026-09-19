import { describe, expect, it } from 'vitest';
import { asHttpError, HttpError } from './http.error';
import { InvalidBuildResultError } from './domain.error';
import { InputValidationError } from '../validation/input-validation';

describe('asHttpError', () => {
  it('passes through HttpError', () => {
    const error = new HttpError({
      code: 'NOT_FOUND',
      message: 'Route not found',
      status: 404,
    });

    expect(asHttpError(error)).toBe(error);
  });

  it('maps validation and domain errors', () => {
    expect(
      asHttpError(new InputValidationError([{ message: 'x', path: ['id'] }])),
    ).toMatchObject({ code: 'VALIDATION_ERROR', status: 422 });
    expect(asHttpError(new InvalidBuildResultError())).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });

  it('maps 413-like errors and falls back to 500', () => {
    expect(asHttpError({ status: 413 })).toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
      status: 413,
    });
    expect(asHttpError(null)).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    expect(asHttpError('boom')).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
    expect(asHttpError({ status: '413' })).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });
});
