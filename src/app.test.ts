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
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

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
      method: 'POST',
      body: '{broken',
    });

    expect(unknown.status).toBe(404);
    expect((await unknown.json()).error.code).toBe('PROVIDER_NOT_FOUND');
    const unsupported = await app.request('/v1/acorn/clients/build-request', {
      method: 'POST',
      body: '{broken',
    });

    expect(unsupported.status).toBe(400);
    expect((await unsupported.json()).error.code).toBe(
      'OPERATION_NOT_SUPPORTED',
    );
    const unknownOperation = await app.request('/v1/acorn/clients/nope', {
      method: 'POST',
      body: '{broken',
    });
    expect(unknownOperation.status).toBe(400);
    expect((await unknownOperation.json()).error.code).toBe(
      'OPERATION_NOT_SUPPORTED',
    );
    const cosperNormalise = createApp({
      providers: createBuiltInRegistry().filter(
        (provider) => provider.name === 'cosper',
      ),
    });
    const unsupportedCosper = await cosperNormalise.request(
      '/v1/cosper/clients/normalise',
      { method: 'POST', body: '{broken' },
    );
    expect(unsupportedCosper.status).toBe(400);
    expect((await unsupportedCosper.json()).error.code).toBe(
      'OPERATION_NOT_SUPPORTED',
    );

    for (const operation of ['constructor', 'toString', '__proto__', 'fail']) {
      const inherited = await app.request(`/v1/acorn/clients/${operation}`, {
        method: 'POST',
        body: '{broken',
      });

      expect(inherited.status).toBe(400);
      expect((await inherited.json()).error.code).toBe(
        'OPERATION_NOT_SUPPORTED',
      );
    }
  });

  it('normalises both source providers through generic routes', async () => {
    const acornInput: AcornPayload = { id: 7 };

    const acornResponse = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      ...json(acornInput),
    });

    expect(acornResponse.status).toBe(200);
    expect((await acornResponse.json()).id).toBe(String(acornInput.id).trim());
    const beaconInput: BeaconPayload = { recordId: 'b' };

    const beaconResponse = await app.request('/v1/beacon/clients/normalise', {
      method: 'POST',
      ...json(beaconInput),
    });

    expect(beaconResponse.status).toBe(200);
    expect((await beaconResponse.json()).id).toBe(beaconInput.recordId.trim());
  });

  it('builds a simulated Cosper envelope', async () => {
    const canonicalInput: CanonicalClient = {
      id: '90210',
      title: null,
      first_name: 'Priya',
      middle_names: null,
      last_name: 'Chandra-Bose',
      full_name: 'Priya Chandra-Bose',
      date_of_birth: null,
      ni_number: null,
      legal_sex: 'female',
      marital_status: 'single',
      nationality: null,
      addresses: [],
      contact_details: [],
    };

    const response = await app.request('/v1/cosper/clients/build-request', {
      method: 'POST',
      ...json(canonicalInput),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: 'cosper',
      request: { ClientRef: canonicalInput.id, Sex: 1, MaritalStatus: 1 },
      response: {
        simulated: true,
        status: 'created',
        clientRef: canonicalInput.id,
      },
      warnings: [],
    });
  });

  it('classifies malformed JSON, validation and unknown routes', async () => {
    const malformed = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      body: '{broken',
    });

    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe('INVALID_JSON');
    const acornInput: AcornPayload = { id: -1 };

    const invalid = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      ...json(acornInput),
    });

    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.code).toBe('VALIDATION_ERROR');
    const missing = await app.request('/v1/unknown');

    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('NOT_FOUND');
  });

  it('returns safe 500 and logs context when an adapter fails', async () => {
    const calls: { message: string; context: Record<string, unknown> }[] = [];

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
      providers: failing,
      logger: {
        error: (message, context) => calls.push({ message, context }),
      },
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
      message: 'Unexpected ZeroKey error',
      context: { path: '/v1/acorn/clients/normalise', method: 'POST' },
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
              execute: (input: InspectionRequest): InspectionResult => ({
                inspected: input,
              }),
              documentation: {
                summary: 'Inspect a future-provider payload',
                requestExample: inspectionRequest,
              },
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
      (await (await extensible.request('/openapi.json')).json()).paths[
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
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 7 }),
    });

    expect(upper.status).toBe(200);

    const wrongType = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ id: 7 }),
    });

    expect(wrongType.status).toBe(400);
    expect((await wrongType.json()).error.code).toBe('INVALID_JSON');

    const empty = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '',
    });

    expect(empty.status).toBe(400);
    expect((await empty.json()).error.code).toBe('INVALID_JSON');
  });

  it('rejects oversized bodies with 413', async () => {
    const big = await app.request('/v1/acorn/clients/normalise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 1, pad: 'x'.repeat(120 * 1024) }),
    });

    expect(big.status).toBe(413);
    expect((await big.json()).error.code).toBe('PAYLOAD_TOO_LARGE');
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
