import * as valibot from 'valibot';
import { InputValidationError } from './input-validation';

export interface CompatValidationError {
  issues: readonly valibot.BaseIssue<unknown>[];
}

export interface CompatValidatedSchema<TParsed, TInput = unknown> {
  readonly schema: valibot.BaseSchema<
    TInput,
    TParsed,
    valibot.BaseIssue<unknown>
  >;
  parse(input: unknown): TParsed;
  safeParse(input: unknown):
    | { success: true; data: TParsed }
    | {
        success: false;
        error: CompatValidationError;
      };
}

export function asCompatSchema<TParsed, TInput = unknown>(
  schema: valibot.BaseSchema<TInput, TParsed, valibot.BaseIssue<unknown>>,
): CompatValidatedSchema<TParsed, TInput> {
  return {
    schema,
    parse(input) {
      const parseResult = valibot.safeParse(schema, input);

      if (!parseResult.success) {
        throw new InputValidationError({ issues: parseResult.issues });
      }

      return parseResult.output;
    },
    safeParse(input) {
      const parseResult = valibot.safeParse(schema, input);

      return parseResult.success
        ? { success: true, data: parseResult.output }
        : { success: false, error: { issues: parseResult.issues } };
    },
  };
}

export type InferCompatOutput<Schema> =
  Schema extends CompatValidatedSchema<infer TParsed, unknown>
    ? TParsed
    : never;

export type InferCompatInput<Schema> =
  Schema extends CompatValidatedSchema<unknown, infer TInput>
    ? TInput
    : unknown;
