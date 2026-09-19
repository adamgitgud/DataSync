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
  readonly description?: string;
  readonly requestExample?: object | undefined;
  readonly requestSchema?: string;
  readonly responseSchema?: string;
  readonly summary?: string;
}

export interface ProviderOperationDefinition<
  TBody = unknown,
  TResult = unknown,
  TFormatted = TResult,
  TQuery = unknown,
> {
  readonly bodySchema?: InputSchema<TBody>;
  readonly documentation?: ProviderOperationDocumentation;
  execute(input: TBody, query?: TQuery): TResult | Promise<TResult>;
  formatResult?(provider: string, result: TResult): TFormatted;
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
    message: string;
    path: (string | number)[];
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
  readonly definition: AnyProviderOperation;
  readonly provider: ProviderCapabilityPort;
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
  find(name: string): ProviderCapabilityPort | undefined;
  findOperation(
    name: string,
    operation: string,
  ): ResolvedProviderOperation | undefined;
  list(): ProviderCapabilitySummary[];
}

export interface ExecuteOperationArgs {
  readonly input: unknown;
  readonly operation: string;
  readonly provider: string;
  readonly query: unknown;
}

export interface ClientsServicePort {
  buildRequest(
    provider: string,
    input: unknown,
  ): BuildRequestResult | Promise<BuildRequestResult>;
  execute(args: ExecuteOperationArgs): unknown;
  listProviders(): ProviderCapabilitySummary[];
  normalise(
    provider: string,
    input: unknown,
  ): CanonicalClient | Promise<CanonicalClient>;
}

export interface ClientsControllerPort {
  readonly executeOperation: Handler<{ Variables: DependencyVariables }>;
  readonly listProviders: Handler<{ Variables: DependencyVariables }>;
}

export type ProviderBuildResponse<
  BuildResult extends BuildRequestResult = BuildRequestResult,
> = BuildResult & { provider: string };
