export interface ValidationIssue {
  message: string;
  path: (string | number)[];
}

export class InputValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(
    error:
      | {
          issues?: readonly {
            message?: string;
            path?: readonly unknown[] | undefined;
          }[];
        }
      | ValidationIssue[],
  ) {
    super('Invalid request payload');
    this.name = 'InputValidationError';
    const issues = Array.isArray(error) ? error : (error.issues ?? []);

    this.issues = issues.map((issue) => ({
      message: issue.message ?? 'Invalid value',
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
    }));
  }
}

export interface InputSchema<ParsedInput> {
  safeParse(input: unknown):
    | { data: ParsedInput; success: true }
    | {
        error: {
          issues?: readonly {
            message?: string;
            path?: readonly unknown[] | undefined;
          }[];
        };
        success: false;
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
