import type {
  ProviderCapabilitySummary,
  ProviderRegistryPort,
} from '../clients/clients.interfaces';
import type { CosperRequest } from '../integrations/cosper/cosper.schema';
import type { AcornPayload, BeaconPayload } from '../testing/payloads';
import { describe, expect, it } from 'vitest';
import { throwInvariant } from '../common/errors/invariant';
import OpenAPISchemaValidator from 'openapi-schema-validator';
import type { OpenAPI } from 'openapi-types';
import { openApiDocument, operationDocumentation } from './openapi';
import { providerOperation } from '../clients/clients.interfaces';
import { acornClientSchema } from '../integrations/acorn/acorn.schema';
import { beaconClientSchema } from '../integrations/beacon/beacon.schema';
import { canonicalClientSchema } from '../clients/schemas/canonical-client.schema';
import { cosperRequestSchema } from '../integrations/cosper/cosper.schema';
import { createBuiltInRegistry } from '../integrations/provider.registry';
import { minimalClient } from '../testing/factories';

function requestExample(
  document: ReturnType<typeof openApiDocument>,
  path: string,
): unknown {
  const body = document.paths[path]?.post?.requestBody;

  if (body === undefined || '$ref' in body) {
    throw new Error(`Missing inline request body: ${path}`);
  }

  const example = body.content['application/json']?.examples?.['sample'];

  if (example === undefined || '$ref' in example) {
    throw new Error(`Missing inline request example: ${path}`);
  }

  return example.value;
}

function requiredKeys(schema: unknown): string[] {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new Error('Expected schema object with required keys');
  }

  const required: unknown = (schema as Record<string, unknown>)['required'];

  if (!Array.isArray(required)) {
    throw new Error('Expected schema required array');
  }

  return required.map((entry) => String(entry)).sort();
}

describe('OpenAPI document', () => {
  const capabilities: readonly ProviderCapabilitySummary[] = [
    {
      slug: 'acorn',
      supports: ['normalise'],
    },
    {
      slug: 'beacon',
      supports: ['normalise'],
    },
    {
      slug: 'cosper',
      supports: ['build-request'],
    },
  ];

  function documentedDocument(
    caps: readonly ProviderCapabilitySummary[] = capabilities,
  ) {
    const entries = createBuiltInRegistry();

    const registry: ProviderRegistryPort = {
      find: (name: string) => entries.find((entry) => entry.name === name),
      findOperation: (name: string, operation: string) => {
        const provider = entries.find((entry) => entry.name === name);

        if (provider === undefined) {
          return undefined;
        }

        const definition = providerOperation(provider, operation);

        if (definition === undefined) {
          return undefined;
        }

        return { definition, provider };
      },
      list: () => [],
    };

    return openApiDocument(caps, operationDocumentation(registry, caps));
  }

  it('documents exactly the registered operation capabilities', () => {
    const document = documentedDocument();

    expect(Object.keys(document.paths)).toEqual([
      '/health',
      '/v1/providers',
      '/v1/acorn/clients/normalise',
      '/v1/beacon/clients/normalise',
      '/v1/cosper/clients/build-request',
    ]);
    expect(document.paths['/v1/cosper/clients/build-request']).toMatchObject({
      post: { operationId: 'buildRequestCosper' },
    });
    expect(document.paths['/v1/acorn/clients/normalise']).toMatchObject({
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AcornClient' },
            },
          },
        },
      },
    });
  });

  it('contains resolved canonical, request, response and error schemas', () => {
    const document = openApiDocument(capabilities);
    const { schemas } = document.components;

    expect(schemas).toHaveProperty('ProviderCapability');
    expect(schemas.ProviderCapability).toMatchObject({
      additionalProperties: false,
      properties: {
        slug: { type: 'string' },
        supports: { items: { type: 'string' }, type: 'array' },
      },
      required: ['slug', 'supports'],
      type: 'object',
    });
    expect(document.paths['/v1/providers']).toMatchObject({
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  items: { $ref: '#/components/schemas/ProviderCapability' },
                  type: 'array',
                },
              },
            },
          },
        },
      },
    });
    expect(schemas).toHaveProperty('CanonicalClient');
    expect(schemas).toHaveProperty('SimulatedCosperResponse');
    expect(schemas).toHaveProperty('ErrorResponse');
    expect(schemas.SimulatedCosperResponse).toMatchObject({
      required: ['provider', 'request', 'response', 'warnings'],
    });
    expect(schemas.ErrorResponse).toMatchObject({
      required: ['error'],
    });
    expect(schemas.CanonicalClient).toMatchObject({
      additionalProperties: false,
      type: 'object',
    });
    expect(requiredKeys(schemas.CanonicalClient)).toEqual(
      [
        'addresses',
        'contact_details',
        'date_of_birth',
        'first_name',
        'full_name',
        'id',
        'last_name',
        'legal_sex',
        'marital_status',
        'middle_names',
        'nationality',
        'ni_number',
        'title',
      ].sort(),
    );
    expect(
      schemas.SimulatedCosperResponse.properties?.['request'],
    ).toMatchObject({
      additionalProperties: false,
      type: 'object',
    });
    expect(
      requiredKeys(schemas.SimulatedCosperResponse.properties?.['request']),
    ).toEqual(
      [
        'AddressLine1',
        'AddressLine2',
        'ClientRef',
        'Country',
        'DateOfBirth',
        'Email',
        'Forename',
        'MaritalStatus',
        'Postcode',
        'Sex',
        'Surname',
        'Telephone',
        'Town',
      ].sort(),
    );
    expect(schemas.CanonicalClient.properties?.['title']).toMatchObject({
      nullable: true,
      type: 'string',
    });
    expect(schemas.CanonicalClient.properties?.['addresses']).toMatchObject({
      type: 'array',
    });
    expect(
      requiredKeys(
        (
          schemas.CanonicalClient.properties?.['addresses'] as {
            items?: unknown;
          }
        )?.items,
      ),
    ).toEqual(
      [
        'country',
        'county',
        'line1',
        'line2',
        'move_in_date',
        'postcode',
        'primary',
        'town_city',
      ].sort(),
    );
    const operation = (document.paths['/v1/cosper/clients/build-request'] ??
      throwInvariant('Missing Cosper operation')) as {
      post: { responses: Record<string, unknown> };
    };

    for (const status of ['400', '404', '413', '422', '500']) {
      expect(
        operation.post.responses[status] ??
          throwInvariant(`Missing ${status} response`),
      ).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      });
    }
  });

  it('does not share or cache capability-derived paths', () => {
    const acorn = openApiDocument([{ slug: 'acorn', supports: ['normalise'] }]);
    const cosper = openApiDocument([
      { slug: 'cosper', supports: ['build-request'] },
    ]);

    expect(Object.keys(acorn.paths)).toEqual([
      '/health',
      '/v1/providers',
      '/v1/acorn/clients/normalise',
    ]);
    expect(Object.keys(cosper.paths)).toEqual([
      '/health',
      '/v1/providers',
      '/v1/cosper/clients/build-request',
    ]);
  });

  it('uses a safe fallback schema for synthetic capabilities', () => {
    const document = openApiDocument([
      { slug: 'future-provider', supports: ['normalise'] },
    ]);
    const operation = (document.paths[
      '/v1/future-provider/clients/normalise'
    ] ?? throwInvariant('Missing future-provider operation')) as {
      post: {
        requestBody: { content: Record<string, { schema: unknown }> };
      };
    };
    expect(
      operation.post.requestBody.content['application/json']?.schema ??
        throwInvariant('Missing JSON schema'),
    ).toEqual({ additionalProperties: true, type: 'object' });
    const empty = openApiDocument([{ slug: '', supports: [''] }]);
    const emptyOperation = (empty.paths['/v1//clients/'] ??
      throwInvariant('Missing empty operation')) as {
      post: { operationId: unknown };
    };
    expect(emptyOperation.post.operationId).toBe('');
  });

  it('keeps documented examples valid against runtime schemas', () => {
    const document = documentedDocument();
    const operation = (path: string) => requestExample(document, path);
    expect(
      acornClientSchema.safeParse(operation('/v1/acorn/clients/normalise'))
        .success,
    ).toBe(true);
    expect(
      beaconClientSchema.safeParse(operation('/v1/beacon/clients/normalise'))
        .success,
    ).toBe(true);
    expect(
      canonicalClientSchema.safeParse(
        operation('/v1/cosper/clients/build-request'),
      ).success,
    ).toBe(true);
  });

  it('keeps documented request constraints aligned with runtime rejection', () => {
    const document = documentedDocument();
    const example = (path: string) => requestExample(document, path);

    const acornInput: AcornPayload = {
      ...(example('/v1/acorn/clients/normalise') as object),
      id: -1,
    };

    expect(acornClientSchema.safeParse(acornInput).success).toBe(false);
    const beaconInput: BeaconPayload = {
      ...(example('/v1/beacon/clients/normalise') as object),
      recordId: ' ',
    };

    expect(beaconClientSchema.safeParse(beaconInput).success).toBe(false);
    const defaultClient = minimalClient();
    const cosperInput: CosperRequest & Record<'unexpected', boolean> = {
      AddressLine1: null,
      AddressLine2: null,
      ClientRef: defaultClient.id,
      Country: null,
      DateOfBirth: null,
      Email: null,
      Forename: null,
      MaritalStatus: 0,
      Postcode: null,
      Sex: 2,
      Surname: null,
      Telephone: null,
      Town: null,
      unexpected: true,
    };

    expect(cosperRequestSchema.safeParse(cosperInput).success).toBe(false);
  });

  it('is valid OpenAPI 3.0 according to an independent validator', () => {
    const validator = new OpenAPISchemaValidator({ version: 3 });
    const document = documentedDocument();

    expect(validator.validate(document as OpenAPI.Document).errors).toEqual([]);
  });

  it('has no unreferenced component schemas', () => {
    const document = documentedDocument();
    const refs = new Set<string>();

    JSON.stringify(document, (_key, value) => {
      if (
        value !== null &&
        typeof value === 'object' &&
        typeof (value as { $ref?: unknown }).$ref === 'string'
      ) {
        refs.add((value as { $ref: string }).$ref.split('/').pop()!);
      }

      return value as unknown;
    });

    for (const name of Object.keys(document.components.schemas)) {
      expect(refs.has(name)).toBe(true);
    }
  });

  it('documents provider and operation path params', () => {
    const document = documentedDocument();
    const operation = (document.paths['/v1/acorn/clients/normalise'] ??
      throwInvariant('Missing Acorn operation')) as {
      post: { parameters: { in: string; name: string; required: boolean }[] };
    };

    expect(operation.post.parameters).toMatchObject([
      { in: 'path', name: 'provider', required: true },
      { in: 'path', name: 'operation', required: true },
    ]);
  });
});
