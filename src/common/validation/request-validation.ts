import * as valibot from 'valibot';
import type { Context } from 'hono';
import { HttpError } from '../errors/http.error';
import { parseInput, type InputSchema } from './input-validation';
import { asCompatSchema } from './schema-compat';

const nonEmptySlug = valibot.pipe(
  valibot.string(),
  valibot.trim(),
  valibot.minLength(1),
);

export const providerParamsSchema = asCompatSchema(
  valibot.object({
    operation: nonEmptySlug,
    provider: nonEmptySlug,
  }),
);

export type ProviderParams = valibot.InferOutput<
  typeof providerParamsSchema.schema
>;

export interface ValidatedProviderRequest<TBody = unknown, TQuery = unknown> {
  body: TBody;
  params: ProviderParams;
  query: TQuery;
}

export function validateProviderRequest<TBody = unknown, TQuery = unknown>(
  definition: {
    readonly bodySchema?: InputSchema<TBody> | undefined;
    readonly querySchema?: InputSchema<TQuery> | undefined;
  },
  params: ProviderParams,
  raw: { readonly body: unknown; readonly query: unknown },
): ValidatedProviderRequest<TBody, TQuery> {
  const query =
    definition.querySchema === undefined
      ? (raw.query as TQuery)
      : parseInput(definition.querySchema, raw.query);

  const body =
    definition.bodySchema === undefined
      ? (raw.body as TBody)
      : parseInput(definition.bodySchema, raw.body);

  return { body, params, query };
}

export async function parseJsonBody(context: Context): Promise<unknown> {
  const request = context.req.raw;
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError({
      code: 'INVALID_JSON',
      message: 'Expected application/json request body',
      status: 400,
    });
  }

  try {
    const text = await request.text();

    if (text.trim() === '') {
      throw new HttpError({
        code: 'INVALID_JSON',
        message: 'Empty JSON request body',
        status: 400,
      });
    }

    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError({
      code: 'INVALID_JSON',
      message: 'Malformed JSON request body',
      status: 400,
    });
  }
}
