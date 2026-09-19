import type { CanonicalClient } from './clients/schemas/canonical-client.schema';
import type { ProviderCapabilityPort } from './clients/clients.interfaces';
import type { AcornPayload, BeaconPayload } from './testing/payloads';
import { describe, expect, it } from 'vitest';
import { throwInvariant } from './common/errors/invariant';
import { app, createApp } from './app';
import { createBuiltInRegistry } from './integrations/provider.registry';

interface InspectionRequest {
  value: string;
}

interface InspectionResult {
  inspected: InspectionRequest;
}

const json = (value: unknown): RequestInit => ({
  body: JSON.stringify(value),
  headers: { 'content-type': 'application/json' },
});

interface ErrorEnvelope {
  error: { code: string };
}

interface IdEnvelope {
  id: string;
}

interface OpenApiPaths {
  paths: Record<string, unknown>;
}

async function errorCode(response: Response): Promise<string> {
  const body = (await response.json()) as unknown as ErrorEnvelope;

  return body.error.code;
}

async function responseId(response: Response): Promise<unknown> {
  const body = (await response.json()) as unknown as IdEnvelope;

  return body.id;
}

async function responsePaths(
  response: Response,
): Promise<Record<string, unknown>> {
  const body = (await response.json()) as unknown as OpenApiPaths;

  return body.paths;
}

describe('HTTP registry routes', () => {
  it('lists capabilities in order', async () => {
    const response = await app.request('/v1/providers');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { slug: 'acorn', supports: ['normalise'] },
      { slug: 'beacon', supports: ['normalise'] },
      { slug: 'cosper', supports: ['build-request'] },
    ]);
  });

  it('resolves provider and operation before malformed body parsing', async () => {
    const unknown = await app.request('/v1/unknown/clients/normalise', {
      body: '{broken',
      method: 'POST',
    });

    expect(unknown.status).toBe(404);
    expect(await errorCode(unknown)).toBe('PROVIDER_NOT_FOUND');
    const unsupported = await app.request('/v1/acorn/clients/build-request', {
      body: '{broken',
      method: 'POST',
    });

    expect(unsupported.status).toBe(400);
    expect(await errorCode(unsupported)).toBe('OPERATION_NOT_SUPPORTED');
    const unknownOperation = await app.request('/v1/acorn/clients/nope', {
      body: '{broken',
      method: 'POST',
    });
    expect(unknownOperation.status).toBe(400);
    expect(await errorCode(unknownOperation)).toBe('OPERATION_NOT_SUPPORTED');
    const cosperNormalise = createApp({
      providers: createBuiltInRegistry().filter(
        (provider) => provider.name === 'cosper',
      ),
    });
    const unsupportedCosper = await cosperNormalise.request(
      '/v1/cosper/clients/normalise',
      { body: '{broken', method: 'POST' },
    );
    expect(unsupportedCosper.status).toBe(400);
    expect(await errorCode(unsupportedCosper)).toBe('OPERATION_NOT_SUPPORTED');

    for (const operation of ['constructor', 'toString', '__proto__', 'fail']) {
      const inherited = await app.request(`/v1/acorn/clients/${operation}`, {
        body: '{broken',
        method: 'POST',
      });

      expect(inherited.status).toBe(400);
      expect(await errorCode(inherited)).toBe('OPERATION_NOT_SUPPORTED');
    }
  });

  it('normalises both source providers through generic routes', async () => {
    const acornInput: AcornPayload = { id: 7 };

    const acornResponse = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      ...json(acornInput),
    });

    expect(acornResponse.status).toBe(200);
    expect(await responseId(acornResponse)).toBe(String(acornInput.id).trim());
    const beaconInput: BeaconPayload = { recordId: 'b' };

    const beaconResponse = await app.request('/v1/beacon/clients/normalise', {
      method: 'POST',
      ...json(beaconInput),
    });

    expect(beaconResponse.status).toBe(200);
    expect(await responseId(beaconResponse)).toBe(beaconInput.recordId.trim());
  });

  it('builds a simulated Cosper envelope', async () => {
    const canonicalInput: CanonicalClient = {
      addresses: [],
      contact_details: [],
      date_of_birth: null,
      first_name: 'Priya',
      full_name: 'Priya Chandra-Bose',
      id: '90210',
      last_name: 'Chandra-Bose',
      legal_sex: 'female',
      marital_status: 'single',
      middle_names: null,
      nationality: null,
      ni_number: null,
      title: null,
    };

    const response = await app.request('/v1/cosper/clients/build-request', {
      method: 'POST',
      ...json(canonicalInput),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: 'cosper',
      request: { ClientRef: canonicalInput.id, MaritalStatus: 1, Sex: 1 },
      response: {
        clientRef: canonicalInput.id,
        simulated: true,
        status: 'created',
      },
      warnings: [],
    });
  });

  it('classifies malformed JSON, validation and unknown routes', async () => {
    const malformed = await app.request('/v1/acorn/clients/normalise', {
      body: '{broken',
      method: 'POST',
    });

    expect(malformed.status).toBe(400);
    expect(await errorCode(malformed)).toBe('INVALID_JSON');
    const acornInput: AcornPayload = { id: -1 };

    const invalid = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      ...json(acornInput),
    });

    expect(invalid.status).toBe(422);
    expect(await errorCode(invalid)).toBe('VALIDATION_ERROR');
    const missing = await app.request('/v1/unknown');

    expect(missing.status).toBe(404);
    expect(await errorCode(missing)).toBe('NOT_FOUND');
  });

  it('returns safe 500 and logs context when an adapter fails', async () => {
    const calls: { context: Record<string, unknown>; message: string }[] = [];

    const provider: ProviderCapabilityPort = {
      name: 'acorn' as const,
      operations: {
        normalise: {
          execute: () => {
            throw new Error('secret payload details');
          },
        },
      },
    };

    const failing = [provider];

    const testApp = createApp({
      logger: {
        error: (message, context) => calls.push({ context, message }),
      },
      providers: failing,
    });

    const acornInput: AcornPayload = { id: 'private' };

    const response = await testApp.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      ...json(acornInput),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0] ?? throwInvariant('Expected a logged call')).toMatchObject({
      context: { method: 'POST', path: '/v1/acorn/clients/normalise' },
      message: 'Unexpected ZeroKey error',
    });
    expect(calls[0]?.context).toHaveProperty('error');
    expect(JSON.stringify(calls)).not.toContain('private');
  });

  it('allows an isolated registry override', async () => {
    const isolated = createApp({
      providers: createBuiltInRegistry().filter(
        (provider) => provider.name === 'cosper',
      ),
    });

    expect(await (await isolated.request('/v1/providers')).json()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
    expect(createBuiltInRegistry()).toHaveLength(3);
  });

  it('keeps concurrent app graphs isolated', async () => {
    const acornApp = createApp({
      providers: createBuiltInRegistry().filter(
        (provider) => provider.name === 'acorn',
      ),
    });
    const cosperApp = createApp({
      providers: createBuiltInRegistry().filter(
        (provider) => provider.name === 'cosper',
      ),
    });

    const [acorn, cosper] = await Promise.all([
      acornApp.request('/v1/providers'),
      cosperApp.request('/v1/providers'),
    ]);

    expect(await acorn.json()).toEqual([
      { slug: 'acorn', supports: ['normalise'] },
    ]);
    expect(await cosper.json()).toEqual([
      { slug: 'cosper', supports: ['build-request'] },
    ]);
  });

  it('dispatches a newly registered operation without changing the HTTP layer', async () => {
    const inspectionRequest: InspectionRequest = {
      value: 'example',
    };

    const extensible = createApp({
      providers: [
        {
          name: 'future-provider',
          operations: {
            inspect: {
              documentation: {
                requestExample: inspectionRequest,
                summary: 'Inspect a future-provider payload',
              },
              execute: (input: InspectionRequest): InspectionResult => ({
                inspected: input,
              }),
            },
          },
        },
      ],
    });

    const inspectionRequest2: InspectionRequest = { value: 'payload' };

    const response = await extensible.request(
      '/v1/future-provider/clients/inspect',
      {
        method: 'POST',
        ...json(inspectionRequest2),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      inspected: { value: 'payload' },
    });
    expect(
      (await responsePaths(await extensible.request('/openapi.json')))[
        '/v1/future-provider/clients/inspect'
      ],
    ).toBeDefined();
  });

  it('serves OpenAPI JSON and Swagger UI without changing API routes', async () => {
    const spec = await app.request('/openapi.json');

    expect(spec.status).toBe(200);
    const document = (await spec.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };

    expect(document.openapi).toBe('3.0.3');
    expect(Object.keys(document.paths)).toEqual([
      '/health',
      '/v1/providers',
      '/v1/acorn/clients/normalise',
      '/v1/beacon/clients/normalise',
      '/v1/cosper/clients/build-request',
    ]);
    const docs = await app.request('/docs');

    expect(docs.status).toBe(200);
    expect(docs.headers.get('content-type')).toContain('text/html');
    expect(await docs.text()).toContain('SwaggerUIBundle');
  });

  it('serves health, resolves slugs case-insensitively and validates content-type', async () => {
    const health = await app.request('/health');

    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });

    const upper = await app.request('/v1/ACORN/clients/normalise', {
      body: JSON.stringify({ id: 7 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(upper.status).toBe(200);

    const wrongType = await app.request('/v1/acorn/clients/normalise', {
      body: JSON.stringify({ id: 7 }),
      headers: { 'content-type': 'text/plain' },
      method: 'POST',
    });

    expect(wrongType.status).toBe(400);
    expect(await errorCode(wrongType)).toBe('INVALID_JSON');

    const empty = await app.request('/v1/acorn/clients/normalise', {
      body: '',
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(empty.status).toBe(400);
    expect(await errorCode(empty)).toBe('INVALID_JSON');
  });

  it('rejects oversized bodies with 413', async () => {
    const big = await app.request('/v1/acorn/clients/normalise', {
      body: JSON.stringify({ id: 1, pad: 'x'.repeat(120 * 1024) }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    expect(big.status).toBe(413);
    expect(await errorCode(big)).toBe('PAYLOAD_TOO_LARGE');
  });

  it('validates query strings per operation and ignores unknown query by default', async () => {
    const { asCompatSchema } =
      await import('./common/validation/schema-compat');
    const valibot = await import('valibot');
    const queryApp = createApp({
      providers: [
        {
          name: 'query-provider',
          operations: {
            inspect: {
              execute: (input: InspectionRequest): InspectionResult => ({
                inspected: input,
              }),
              querySchema: asCompatSchema(
                valibot.object({
                  strict: valibot.optional(valibot.picklist(['true', 'false'])),
                }),
              ),
            },
          },
        },
      ],
    });

    const invalidQuery = await queryApp.request(
      '/v1/query-provider/clients/inspect?strict=maybe',
      { method: 'POST', ...json({ id: '7' }) },
    );

    expect(invalidQuery.status).toBe(422);
    const invalidBody = (await invalidQuery.json()) as {
      error: { code: string; issues: { path: (string | number)[] }[] };
    };

    expect(invalidBody.error.code).toBe('VALIDATION_ERROR');
    expect(invalidBody.error.issues[0]?.path).toEqual(['strict']);

    const validQuery = await queryApp.request(
      '/v1/query-provider/clients/inspect?strict=true',
      { method: 'POST', ...json({ id: '7' }) },
    );

    expect(validQuery.status).toBe(200);

    const ignoredQuery = await app.request(
      '/v1/acorn/clients/normalise?anything=goes',
      { method: 'POST', ...json({ id: 7 }) },
    );

    expect(ignoredQuery.status).toBe(200);
  });
});
