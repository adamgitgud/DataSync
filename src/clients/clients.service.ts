import type {
  BuildRequestResult,
  ClientsServicePort,
  ExecuteOperationArgs,
  ProviderRegistryPort,
  ResolvedProviderOperation,
} from './clients.interfaces';
import {
  InvalidBuildResultError,
  OperationNotSupportedError,
} from '../common/errors/domain.error';
import { isRecord } from '../common/validation/source';
import type { CanonicalClient } from './schemas/canonical-client.schema';

function isBuildRequestResult(value: unknown): value is BuildRequestResult {
  if (!isRecord(value)) {
    return false;
  }

  const request = value['request'];
  const response = value['response'];
  const warnings = value['warnings'];

  return (
    isRecord(request) &&
    isRecord(response) &&
    response['simulated'] === true &&
    Array.isArray(warnings)
  );
}

export class ClientsService implements ClientsServicePort {
  constructor(private readonly providerRegistry: ProviderRegistryPort) {}

  listProviders() {
    return this.providerRegistry.list();
  }

  async execute(args: ExecuteOperationArgs): Promise<unknown> {
    return this.run<unknown>(args);
  }

  async normalise(providerName: string, input: unknown) {
    return this.run<CanonicalClient>({
      input,
      operation: 'normalise',
      provider: providerName,
      query: undefined,
    });
  }

  async buildRequest(providerName: string, input: unknown) {
    const formatted = await this.run<unknown>({
      input,
      operation: 'build-request',
      provider: providerName,
      query: undefined,
    });

    if (!isBuildRequestResult(formatted)) {
      throw new InvalidBuildResultError();
    }

    return formatted;
  }

  private async run<TResult>(args: ExecuteOperationArgs): Promise<TResult> {
    const { definition } = this.resolve(args.provider, args.operation);
    const result = await definition.execute(args.input, args.query);

    return (definition.formatResult?.(args.provider, result) ??
      result) as TResult;
  }

  private resolve(
    providerName: string,
    operation: string,
  ): ResolvedProviderOperation {
    const resolved = this.providerRegistry.findOperation(
      providerName,
      operation,
    );

    if (resolved === undefined) {
      throw new OperationNotSupportedError(providerName, operation);
    }

    return resolved;
  }
}
