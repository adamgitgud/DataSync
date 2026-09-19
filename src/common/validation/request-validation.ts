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
    provider: nonEmptySlug,
    operation: nonEmptySlug,
  }),
);

export type ProviderParams = valibot.InferOutput<
  typeof providerParamsSchema.schema
>;

export interface ValidatedProviderRequest<TBody = unknown, TQuery = unknown> {
  params: ProviderParams;
  query: TQuery;
  body: TBody;
}

export function validateProviderRequest<TBody = unknown, TQuery = unknown>(
  definition: {
    readonly bodySchema?: InputSchema<TBody> | undefined;
    readonly querySchema?: InputSchema<TQuery> | undefined;
  },
  params: ProviderParams,
  rawQuery: unknown,
  rawBody: unknown,
): ValidatedProviderRequest<TBody, TQuery> {
  const query =
    definition.querySchema === undefined
      ? (rawQuery as TQuery)
      : parseInput(definition.querySchema, rawQuery);

  const body =
    definition.bodySchema === undefined
      ? (rawBody as TBody)
      : parseInput(definition.bodySchema, rawBody);

  return { params, query, body };
}

export async function parseJsonBody(context: Context): Promise<unknown> {
  const request = context.req.raw;
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new HttpError(
      400,
      'INVALID_JSON',
      'Expected application/json request body',
    );
  }

  try {
    const text = await request.text();

    if (text.trim() === '') {
      throw new HttpError(400, 'INVALID_JSON', 'Empty JSON request body');
    }

    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(400, 'INVALID_JSON', 'Malformed JSON request body');
  }
}
