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
  | 'BeaconBagEntry'
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
  target: 'openapi-3.0' as const,
  errorMode: 'ignore' as const,
};

const errorResponse = (description: string): OpenAPIV3.ResponseObject => ({
  description,
  content: {
    'application/json': { schema: ref('ErrorResponse') },
  },
});

function fallbackRequestSchema(): OpenAPIV3.SchemaObject {
  return { type: 'object', additionalProperties: true };
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
    operationId: toOperationId(provider, operation),
    summary:
      documentation?.summary ??
      (buildRequest
        ? 'Build a simulated Cosper request'
        : `Normalise a ${provider} client payload`),
    description:
      documentation?.description ??
      (buildRequest
        ? 'Cosper creation is simulated; no outbound provider call is made.'
        : 'Validates raw provider JSON, then returns the canonical Client projection. Mappings can be lossy.'),
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: documentation?.requestSchema
            ? ref(documentation.requestSchema)
            : fallbackRequestSchema(),
          examples: {
            sample: {
              summary: 'Synthetic request',
              value: documentation?.requestExample ?? {},
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description:
          documentation?.responseSchema === 'SimulatedCosperResponse'
            ? 'Simulated Cosper response envelope'
            : 'Canonical Client',
        content: {
          'application/json': {
            schema: documentation?.responseSchema
              ? ref(documentation.responseSchema)
              : buildRequest
                ? ref('SimulatedCosperResponse')
                : ref('CanonicalClient'),
          },
        },
      },
      '400': errorResponse('Malformed JSON or unsupported operation'),
      '404': errorResponse('Provider not found'),
      '413': errorResponse('Request body too large'),
      '422': errorResponse('Invalid request payload'),
      '500': errorResponse('Internal server error'),
    },
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
      ProviderCapability: {
        type: 'object',
        required: ['slug', 'supports'],
        additionalProperties: false,
        properties: {
          slug: { type: 'string', description: 'Registered provider slug.' },
          supports: {
            type: 'array',
            items: { type: 'string' },
            description: 'Operations supported by this provider.',
          },
        },
      },
      CanonicalClient: {
        ...convertedSchema(canonicalClientSchema.schema),
        additionalProperties: false,
      },
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
      BeaconBagEntry: {
        type: 'object',
        required: ['key'],
        additionalProperties: false,
        properties: {
          key: { type: 'string' },
          value: { nullable: true },
        },
      },
      SimulatedCosperResponse: {
        type: 'object',
        required: ['provider', 'request', 'response', 'warnings'],
        properties: {
          provider: { enum: ['cosper'] },
          request: convertedSchema(cosperRequestSchema.schema),
          response: {
            type: 'object',
            required: ['simulated', 'status', 'clientRef'],
            properties: {
              simulated: { enum: [true] },
              status: { enum: ['created'] },
              clientRef: { type: 'string' },
            },
          },
          warnings: {
            type: 'array',
            items: {
              type: 'object',
              required: ['code', 'path', 'message'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'MARITAL_STATUS_UNREPRESENTABLE',
                    'MARITAL_STATUS_UNKNOWN',
                    'LEGAL_SEX_DEFAULTED',
                  ],
                },
                path: {
                  type: 'array',
                  items: { type: 'string' },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      ErrorIssue: {
        type: 'object',
        required: ['path', 'message'],
        properties: {
          path: {
            type: 'array',
            items: { type: 'string' },
          },
          message: { type: 'string' },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              issues: { type: 'array', items: ref('ErrorIssue') },
            },
          },
        },
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
        operationId: 'healthCheck',
        description: 'Liveness probe.',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': json({
                type: 'object',
                required: ['status'],
                properties: { status: { enum: ['ok'] } },
              }),
            },
          },
        },
      },
    },
    '/v1/providers': {
      get: {
        operationId: 'listProviders',
        description:
          'Lists registered providers and their supported operations.',
        responses: {
          '200': {
            description: 'Registered provider capabilities',
            content: {
              'application/json': json({
                type: 'array',
                items: ref('ProviderCapability'),
              }),
            },
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
    openapi: '3.0.3',
    info: {
      title: 'ZeroKey integration service',
      version: '1.0.0',
      description:
        'Provider normalisation and simulated Cosper request building. Capability checks happen before request-body parsing; Cosper creation is simulated.',
    },
    servers: [{ url: '/', description: 'Current server origin' }],
    paths,
    components: components(),
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
