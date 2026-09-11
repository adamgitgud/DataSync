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
  readonly requestExample?: unknown;
}

export interface ProviderOperationDefinition<
  TInput = unknown,
  TResult = unknown,
  TFormatted = TResult,
> {
  readonly execute: (input: TInput) => TResult | Promise<TResult>;
  readonly formatResult?: (provider: string, result: TResult) => TFormatted;
  readonly documentation?: ProviderOperationDocumentation;
}

export interface ProviderCapabilitySummary {
  readonly slug: string;
  readonly supports: readonly string[];
}

export interface BuildRequestResult<
  TRequest extends object = Record<string, unknown>,
  TResponse extends object = { simulated: true; [key: string]: unknown },
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
  readonly operations: Readonly<
    Record<TOperation, ProviderOperationDefinition<unknown, unknown, unknown>>
  >;
}

export function providerOperation(
  provider: ProviderCapabilityPort,
  operation: string,
): ProviderOperationDefinition<unknown, unknown, unknown> | undefined {
  if (!Object.hasOwn(provider.operations, operation)) {
    return undefined;
  }

  return provider.operations[operation];
}

export interface ProviderRegistryPort {
  list(): ProviderCapabilitySummary[];
  find(name: string): ProviderCapabilityPort | undefined;
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
  ): unknown | Promise<unknown>;
}

export interface ClientsControllerPort {
  providers(): ProviderCapabilitySummary[];
  operation(
    provider: string,
    operation: string,
    request: Request,
  ): Promise<unknown>;
}

export type ProviderBuildResponse<
  BuildResult extends BuildRequestResult = BuildRequestResult,
> = BuildResult & { provider: string };
