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
          message: 'Bad contact',
          path: [pathKey, pathKey2],
        },
        { path: [pathKey3] },
        { message: 'Boolean path item', path: [true] },
        {},
      ],
    });
    expect(error.name).toBe('InputValidationError');
    expect(error.message).toBe('Invalid request payload');
    expect(error.issues).toEqual([
      { message: 'Bad contact', path: ['contacts', 2] },
      { message: 'Invalid value', path: ['Symbol(field)'] },
      { message: 'Boolean path item', path: ['true'] },
      { message: 'Invalid value', path: [] },
    ]);
  });

  it('accepts application-owned issues and converts failed parses', () => {
    expect(new InputValidationError({}).issues).toEqual([]);
    expect(
      new InputValidationError([{ message: 'Required', path: ['id'] }]).issues,
    ).toEqual([{ message: 'Required', path: ['id'] }]);
    const schema: InputSchema<number> = {
      safeParse: (input: unknown) => {
        const pathKey: ValidationPathKey = { key: 0 };

        return input === 'ok'
          ? { data: 42, success: true as const }
          : {
              error: {
                issues: [
                  {
                    message: 'Nope',
                    path: [pathKey],
                  },
                ],
              },
              success: false as const,
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
        { message: 'Nope', path: [0] },
      ]);
    }
  });
});
