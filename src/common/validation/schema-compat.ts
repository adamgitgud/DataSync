import * as valibot from 'valibot';
import { InputValidationError } from './input-validation';

export interface CompatValidationError {
  issues: readonly valibot.BaseIssue<unknown>[];
}

export interface CompatValidatedSchema<TParsed> {
  readonly schema: valibot.BaseSchema<
    unknown,
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

export function asCompatSchema<TParsed>(
  schema: valibot.BaseSchema<unknown, TParsed, valibot.BaseIssue<unknown>>,
): CompatValidatedSchema<TParsed> {
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
  Schema extends CompatValidatedSchema<infer TParsed> ? TParsed : never;
