import * as valibot from 'valibot';
import { describe, expect, it } from 'vitest';
import { asCompatSchema } from './schema-compat';
import { InputValidationError } from './input-validation';
import {
  providerParamsSchema,
  validateProviderRequest,
} from './request-validation';

const querySchema = asCompatSchema(
  valibot.object({
    strict: valibot.optional(valibot.picklist(['true', 'false'])),
  }),
);

const bodySchema = asCompatSchema(
  valibot.object({ id: valibot.pipe(valibot.string(), valibot.minLength(1)) }),
);

describe('request validation', () => {
  it('accepts trimmed params and rejects blank slugs', () => {
    expect(
      providerParamsSchema.parse({ provider: 'acorn', operation: 'normalise' }),
    ).toEqual({ provider: 'acorn', operation: 'normalise' });
    expect(() =>
      providerParamsSchema.parse({ provider: '  ', operation: 'normalise' }),
    ).toThrow(InputValidationError);
    expect(() =>
      providerParamsSchema.parse({ provider: 'acorn', operation: '' }),
    ).toThrow(InputValidationError);
  });

  it('validates query and body together (params assumed already validated)', () => {
    const validated = validateProviderRequest(
      { bodySchema, querySchema },
      { provider: 'acorn', operation: 'normalise' },
      { strict: 'true' },
      { id: '7' },
    );

    expect(validated).toEqual({
      params: { provider: 'acorn', operation: 'normalise' },
      query: { strict: 'true' },
      body: { id: '7' },
    });
  });

  it('rejects invalid query and body with issue paths', () => {
    try {
      validateProviderRequest(
        { bodySchema, querySchema },
        { provider: 'acorn', operation: 'normalise' },
        { strict: 'maybe' },
        { id: '7' },
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
      expect((error as InputValidationError).issues[0]?.path).toEqual([
        'strict',
      ]);
    }

    try {
      validateProviderRequest(
        { bodySchema, querySchema },
        { provider: 'acorn', operation: 'normalise' },
        {},
        { id: '' },
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
      expect((error as InputValidationError).issues[0]?.path).toEqual(['id']);
    }
  });

  it('passes query through untouched when no query schema is registered', () => {
    const rawQuery = { anything: 'goes' };
    const validated = validateProviderRequest(
      { bodySchema },
      { provider: 'acorn', operation: 'normalise' },
      rawQuery,
      { id: '7' },
    );

    expect(validated.query).toBe(rawQuery);
  });
});
