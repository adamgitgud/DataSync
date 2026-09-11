import { describe, expect, it } from 'vitest';
import { asHttpError, HttpError } from './http.error';
import { InvalidBuildResultError } from './domain.error';
import { InputValidationError } from '../validation/input-validation';

describe('asHttpError', () => {
  it('passes through HttpError', () => {
    const error = new HttpError(404, 'NOT_FOUND', 'Route not found');

    expect(asHttpError(error)).toBe(error);
  });

  it('maps validation and domain errors', () => {
    expect(
      asHttpError(new InputValidationError([{ path: ['id'], message: 'x' }])),
    ).toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
    expect(asHttpError(new InvalidBuildResultError())).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('maps 413-like errors and falls back to 500', () => {
    expect(asHttpError({ status: 413 })).toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(asHttpError(null)).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(asHttpError('boom')).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(asHttpError({ status: '413' })).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});
