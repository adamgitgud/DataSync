export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

export class InputValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(
    error:
      | {
          issues?: readonly {
            path?: readonly unknown[] | undefined;
            message?: string;
          }[];
        }
      | ValidationIssue[],
  ) {
    super('Invalid request payload');
    this.name = 'InputValidationError';
    const issues = Array.isArray(error) ? error : (error.issues ?? []);

    this.issues = issues.map((issue) => ({
      path: (issue.path ?? []).map((part) => {
        if (typeof part === 'number' || typeof part === 'string') {
          return part;
        }

        if (typeof part === 'object' && part !== null && 'key' in part) {
          const { key } = part;

          return typeof key === 'number' ? key : String(key);
        }

        return String(part);
      }),
      message: issue.message ?? 'Invalid value',
    }));
  }
}

export interface InputSchema<ParsedInput> {
  safeParse(input: unknown):
    | { success: true; data: ParsedInput }
    | {
        success: false;
        error: {
          issues?: readonly {
            path?: readonly unknown[] | undefined;
            message?: string;
          }[];
        };
      };
}

export function parseInput<ParsedInput>(
  schema: InputSchema<ParsedInput>,
  input: unknown,
): ParsedInput {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new InputValidationError(result.error);
  }

  return result.data;
}
