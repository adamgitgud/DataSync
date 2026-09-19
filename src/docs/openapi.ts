import type { OpenAPIV3 } from 'openapi-types';
import type { ConversionConfig } from '@valibot/to-json-schema';
import { swaggerUI } from '@hono/swagger-ui';
import { toJsonSchema } from '@valibot/to-json-schema';
import type { Hono } from 'hono';
import { canonicalClientSchema } from '../clients/schemas/canonical-client.schema';
import { cosperRequestSchema } from '../integrations/cosper/cosper.schema';
import { acornClientSchema } from '../integrations/acorn/acorn.schema';
import { beaconClientSchema } from '../integrations/beacon/beacon.schema';
import type { DependencyVariables } from '../common/middleware/dependencies.middleware';
import type {
  ProviderOperationDocumentation,
  ProviderCapabilitySummary,
  ProviderRegistryPort,
} from '../clients/clients.interfaces';
import { providerOperation } from '../clients/clients.interfaces';

type OpenApiSchemaName =
  | 'ProviderCapability'
  | 'CanonicalClient'
  | 'AcornClient'
  | 'BeaconClient'
  | 'SimulatedCosperResponse'
  | 'ErrorIssue'
  | 'ErrorResponse';

interface DocumentComponents extends OpenAPIV3.ComponentsObject {
  schemas: Record<OpenApiSchemaName, OpenAPIV3.SchemaObject>;
}

interface ApiDocument extends OpenAPIV3.Document {
  components: DocumentComponents;
}

const json = (
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
): OpenAPIV3.MediaTypeObject => ({ schema });

const ref = (name: string): OpenAPIV3.ReferenceObject => ({
  $ref: `#/components/schemas/${name}`,
});

const schemaOptions: ConversionConfig = {
  errorMode: 'ignore' as const,
  target: 'openapi-3.0' as const,
};

const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  content: {
    'application/json': { schema: ref('ErrorResponse') },
  },
  description,
});

function fallbackRequestSchema(): OpenAPIV3.SchemaObject {
  return { additionalProperties: true, type: 'object' };
}

function operationPath(provider: string, operation: string): string {
  return `/v1/${provider}/clients/${operation}`;
}

function toOperationId(provider: string, operation: string): string {
  if (provider.trim() === '' || operation.trim() === '') {
    return '';
  }

  const operationName = operation
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`)
    .join('');

  if (operationName === '' || provider.length === 0) {
    return '';
  }

  const providerName = `${provider[0]?.toUpperCase() ?? ''}${provider.slice(1)}`;

  return `${operationName[0]?.toLowerCase() ?? ''}${operationName.slice(1)}${providerName}`;
}

function operationDocument(
  provider: string,
  operation: string,
  documentation?: ProviderOperationDocumentation,
): OpenAPIV3.OperationObject {
  const buildRequest = operation === 'build-request';

  return {
    description:
      documentation?.description ??
      (buildRequest
        ? 'Cosper creation is simulated; no outbound provider call is made.'
        : 'Validates raw provider JSON, then returns the canonical Client projection. Mappings can be lossy.'),
    operationId: toOperationId(provider, operation),
    parameters: [
      {
        in: 'path',
        name: 'provider',
        required: true,
        schema: { minLength: 1, type: 'string' },
      },
      {
        in: 'path',
        name: 'operation',
        required: true,
        schema: { minLength: 1, type: 'string' },
      },
    ],
    requestBody: {
      content: {
        'application/json': {
          examples: {
            sample: {
              summary: 'Synthetic request',
              value: documentation?.requestExample ?? {},
            },
          },
          schema: documentation?.requestSchema
            ? ref(documentation.requestSchema)
            : fallbackRequestSchema(),
        },
      },
      required: true,
    },
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: documentation?.responseSchema
              ? ref(documentation.responseSchema)
              : buildRequest
                ? ref('SimulatedCosperResponse')
                : ref('CanonicalClient'),
          },
        },
        description:
          documentation?.responseSchema === 'SimulatedCosperResponse'
            ? 'Simulated Cosper response envelope'
            : 'Canonical Client',
      },
      '400': errorResponse('Malformed JSON or unsupported operation'),
      '404': errorResponse('Unknown provider or route'),
      '413': errorResponse('Request body too large'),
      '422': errorResponse('Invalid request params, query or payload'),
      '500': errorResponse('Internal server error'),
    },
    summary:
      documentation?.summary ??
      (buildRequest
        ? 'Build a simulated Cosper request'
        : `Normalise a ${provider} client payload`),
  };
}

function convertedSchema(
  schema: Parameters<typeof toJsonSchema>[0],
): OpenAPIV3.SchemaObject {
  return toJsonSchema(
    schema,
    schemaOptions,
  ) as unknown as OpenAPIV3.SchemaObject;
}

function components(): DocumentComponents {
  return {
    schemas: {
      AcornClient: {
        ...convertedSchema(acornClientSchema.schema),
        description:
          'Raw Acorn JSON. Optional source fields may be null or omitted.',
      },
      BeaconClient: {
        ...convertedSchema(beaconClientSchema.schema),
        description:
          'Raw Beacon JSON. Recognized bag values are validated even when superseded.',
      },
      CanonicalClient: {
        ...convertedSchema(canonicalClientSchema.schema),
        additionalProperties: false,
      },
      ErrorIssue: {
        properties: {
          message: { type: 'string' },
          path: {
            items: { type: 'string' },
            type: 'array',
          },
        },
        required: ['path', 'message'],
        type: 'object',
      },
      ErrorResponse: {
        properties: {
          error: {
            properties: {
              code: { type: 'string' },
              issues: { items: ref('ErrorIssue'), type: 'array' },
              message: { type: 'string' },
            },
            required: ['code', 'message'],
            type: 'object',
          },
        },
        required: ['error'],
        type: 'object',
      },
      ProviderCapability: {
        additionalProperties: false,
        properties: {
          slug: { description: 'Registered provider slug.', type: 'string' },
          supports: {
            description: 'Operations supported by this provider.',
            items: { type: 'string' },
            type: 'array',
          },
        },
        required: ['slug', 'supports'],
        type: 'object',
      },
      SimulatedCosperResponse: {
        properties: {
          provider: { enum: ['cosper'] },
          request: convertedSchema(cosperRequestSchema.schema),
          response: {
            properties: {
              clientRef: { type: 'string' },
              simulated: { enum: [true] },
              status: { enum: ['created'] },
            },
            required: ['simulated', 'status', 'clientRef'],
            type: 'object',
          },
          warnings: {
            items: {
              properties: {
                code: {
                  enum: [
                    'MARITAL_STATUS_UNREPRESENTABLE',
                    'MARITAL_STATUS_UNKNOWN',
                    'LEGAL_SEX_DEFAULTED',
                  ],
                  type: 'string',
                },
                message: { type: 'string' },
                path: {
                  items: { type: 'string' },
                  type: 'array',
                },
              },
              required: ['code', 'path', 'message'],
              type: 'object',
            },
            type: 'array',
          },
        },
        required: ['provider', 'request', 'response', 'warnings'],
        type: 'object',
      },
    },
  };
}

export function openApiDocument(
  capabilities: readonly ProviderCapabilitySummary[] = [],
  documentation: Readonly<Record<string, ProviderOperationDocumentation>> = {},
): ApiDocument {
  const paths: OpenAPIV3.PathsObject = {
    '/health': {
      get: {
        description: 'Liveness probe.',
        operationId: 'healthCheck',
        responses: {
          '200': {
            content: {
              'application/json': json({
                properties: { status: { enum: ['ok'] } },
                required: ['status'],
                type: 'object',
              }),
            },
            description: 'Service is healthy',
          },
        },
      },
    },
    '/v1/providers': {
      get: {
        description:
          'Lists registered providers and their supported operations.',
        operationId: 'listProviders',
        responses: {
          '200': {
            content: {
              'application/json': json({
                items: ref('ProviderCapability'),
                type: 'array',
              }),
            },
            description: 'Registered provider capabilities',
          },
        },
      },
    },
  };

  for (const capability of capabilities) {
    for (const operation of capability.supports) {
      paths[operationPath(capability.slug, operation)] = {
        post: operationDocument(
          capability.slug,
          operation,
          documentation[`${capability.slug}/${operation}`],
        ),
      };
    }
  }

  return {
    components: components(),
    info: {
      description:
        'Hono demo comparing Hono with Express.js and NestJS. Provider normalisation and simulated Cosper request building. Capability checks happen before request-body parsing; Cosper creation is simulated.',
      title: 'DataSync integration service',
      version: '1.0.0',
    },
    openapi: '3.0.3',
    paths,
    servers: [{ description: 'Current server origin', url: '/' }],
  };
}

export function registerOpenApiRoutes(
  app: Hono<{ Variables: DependencyVariables }>,
  capabilities: readonly ProviderCapabilitySummary[] = [],
  documentation: Readonly<Record<string, ProviderOperationDocumentation>> = {},
) {
  app.get('/openapi.json', (context) =>
    context.json(openApiDocument(capabilities, documentation)),
  );
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));
}

export function operationDocumentation(
  registry: ProviderRegistryPort,
  capabilities: readonly ProviderCapabilitySummary[],
) {
  const documentation: Record<string, ProviderOperationDocumentation> = {};

  for (const capability of capabilities) {
    const provider = registry.find(capability.slug);

    for (const operation of capability.supports) {
      const definition =
        provider === undefined
          ? undefined
          : providerOperation(provider, operation);

      if (definition?.documentation !== undefined) {
        documentation[`${capability.slug}/${operation}`] =
          definition.documentation;
      }
    }
  }

  return documentation;
}
