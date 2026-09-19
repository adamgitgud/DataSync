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
      providerParamsSchema.parse({ operation: 'normalise', provider: 'acorn' }),
    ).toEqual({ operation: 'normalise', provider: 'acorn' });
    expect(() =>
      providerParamsSchema.parse({ operation: 'normalise', provider: '  ' }),
    ).toThrow(InputValidationError);
    expect(() =>
      providerParamsSchema.parse({ operation: '', provider: 'acorn' }),
    ).toThrow(InputValidationError);
  });

  it('validates query and body together (params assumed already validated)', () => {
    const validated = validateProviderRequest(
      { bodySchema, querySchema },
      { operation: 'normalise', provider: 'acorn' },
      { body: { id: '7' }, query: { strict: 'true' } },
    );

    expect(validated).toEqual({
      body: { id: '7' },
      params: { operation: 'normalise', provider: 'acorn' },
      query: { strict: 'true' },
    });
  });

  it('rejects invalid query and body with issue paths', () => {
    try {
      validateProviderRequest(
        { bodySchema, querySchema },
        { operation: 'normalise', provider: 'acorn' },
        { body: { id: '7' }, query: { strict: 'maybe' } },
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
        { operation: 'normalise', provider: 'acorn' },
        { body: { id: '' }, query: {} },
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
      { operation: 'normalise', provider: 'acorn' },
      { body: { id: '7' }, query: rawQuery },
    );

    expect(validated.query).toBe(rawQuery);
  });
});
