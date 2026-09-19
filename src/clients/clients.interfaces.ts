import type { Handler } from 'hono';
import type { DependencyVariables } from '../common/middleware/dependencies.middleware';
import type { InputSchema } from '../common/validation/input-validation';
import type { CanonicalClient } from './schemas/canonical-client.schema';

export interface BuiltInProviderOperations {
  acorn: 'normalise';
  beacon: 'normalise';
  cosper: 'build-request';
}

export type ProviderName = keyof BuiltInProviderOperations;

export type ProviderOperation = BuiltInProviderOperations[ProviderName];

export type BuiltInProviderCapability = {
  [Name in ProviderName]: ProviderCapabilityPort<
    Name,
    BuiltInProviderOperations[Name]
  >;
}[ProviderName];

export interface ProviderOperationDocumentation {
  readonly requestSchema?: string;
  readonly responseSchema?: string;
  readonly summary?: string;
  readonly description?: string;
  readonly requestExample?: object | undefined;
}

export interface ProviderOperationDefinition<
  TBody = unknown,
  TResult = unknown,
  TFormatted = TResult,
  TQuery = unknown,
> {
  execute(input: TBody, query?: TQuery): TResult | Promise<TResult>;
  formatResult?(provider: string, result: TResult): TFormatted;
  readonly documentation?: ProviderOperationDocumentation;
  readonly bodySchema?: InputSchema<TBody>;
  readonly querySchema?: InputSchema<TQuery>;
}

export type AnyProviderOperation = ProviderOperationDefinition<
  unknown,
  unknown,
  unknown,
  unknown
>;

export interface ProviderCapabilitySummary {
  readonly slug: string;
  readonly supports: readonly string[];
}

export interface BuildRequestResult<
  TRequest extends Record<string, unknown> = Record<string, unknown>,
  TResponse extends Record<string, unknown> & { simulated: true } = Record<
    string,
    unknown
  > & { simulated: true },
  TWarning extends object = {
    code: string;
    path: (string | number)[];
    message: string;
  },
> {
  readonly request: TRequest;
  readonly response: TResponse & { simulated: true };
  readonly warnings: TWarning[];
}

export interface ProviderCapabilityPort<
  TName extends string = string,
  TOperation extends string = string,
> {
  readonly name: TName;
  readonly operations: Readonly<Record<TOperation, AnyProviderOperation>>;
}

export interface ResolvedProviderOperation {
  readonly provider: ProviderCapabilityPort;
  readonly definition: AnyProviderOperation;
}

export function providerOperation(
  provider: ProviderCapabilityPort,
  operation: string,
): AnyProviderOperation | undefined {
  if (!Object.hasOwn(provider.operations, operation)) {
    return undefined;
  }

  return provider.operations[operation];
}

export interface ProviderRegistryPort {
  list(): ProviderCapabilitySummary[];
  find(name: string): ProviderCapabilityPort | undefined;
  findOperation(
    name: string,
    operation: string,
  ): ResolvedProviderOperation | undefined;
}

export interface ClientsServicePort {
  listProviders(): ProviderCapabilitySummary[];
  normalise(
    provider: string,
    input: unknown,
  ): CanonicalClient | Promise<CanonicalClient>;
  buildRequest(
    provider: string,
    input: unknown,
  ): BuildRequestResult | Promise<BuildRequestResult>;
  execute(
    provider: string,
    operation: string,
    input: unknown,
    query?: unknown,
  ): unknown | Promise<unknown>;
}

export interface ClientsControllerPort {
  readonly listProviders: Handler<{ Variables: DependencyVariables }>;
  readonly executeOperation: Handler<{ Variables: DependencyVariables }>;
}

export type ProviderBuildResponse<
  BuildResult extends BuildRequestResult = BuildRequestResult,
> = BuildResult & { provider: string };
