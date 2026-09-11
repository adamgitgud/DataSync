import type { InputSchema } from './input-validation';
import { describe, expect, it } from 'vitest';
import { InputValidationError, parseInput } from './input-validation';

interface ValidationPathKey {
  key: PropertyKey;
}

describe('validation boundary', () => {
  it('normalises Valibot-style paths and fallback messages', () => {
    const pathKey: ValidationPathKey = { key: 'contacts' };

    const pathKey2: ValidationPathKey = { key: 2 };

    const pathKey3: ValidationPathKey = { key: Symbol('field') };

    const error = new InputValidationError({
      issues: [
        {
          path: [pathKey, pathKey2],
          message: 'Bad contact',
        },
        { path: [pathKey3] },
        { path: [true], message: 'Boolean path item' },
        {},
      ],
    });
    expect(error.name).toBe('InputValidationError');
    expect(error.message).toBe('Invalid request payload');
    expect(error.issues).toEqual([
      { path: ['contacts', 2], message: 'Bad contact' },
      { path: ['Symbol(field)'], message: 'Invalid value' },
      { path: ['true'], message: 'Boolean path item' },
      { path: [], message: 'Invalid value' },
    ]);
  });

  it('accepts application-owned issues and converts failed parses', () => {
    expect(new InputValidationError({}).issues).toEqual([]);
    expect(
      new InputValidationError([{ path: ['id'], message: 'Required' }]).issues,
    ).toEqual([{ path: ['id'], message: 'Required' }]);
    const schema: InputSchema<number> = {
      safeParse: (input: unknown) => {
        const pathKey: ValidationPathKey = { key: 0 };

        return input === 'ok'
          ? { success: true as const, data: 42 }
          : {
              success: false as const,
              error: {
                issues: [
                  {
                    path: [pathKey],
                    message: 'Nope',
                  },
                ],
              },
            };
      },
    };
    expect(parseInput(schema, 'ok')).toBe(42);
    expect(() => parseInput(schema, 'bad')).toThrow(InputValidationError);

    try {
      parseInput(schema, 'bad');
    } catch (error) {
      expect(error).toBeInstanceOf(InputValidationError);
      expect((error as InputValidationError).issues).toEqual([
        { path: [0], message: 'Nope' },
      ]);
    }
  });
});
