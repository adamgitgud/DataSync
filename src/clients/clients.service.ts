import type {
  BuildRequestResult,
  ClientsServicePort,
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

  async execute(
    providerName: string,
    operation: string,
    input: unknown,
    query?: unknown,
  ): Promise<unknown> {
    return this.run<unknown>(providerName, operation, input, query);
  }

  async normalise(providerName: string, input: unknown) {
    return this.run<CanonicalClient>(providerName, 'normalise', input);
  }

  async buildRequest(providerName: string, input: unknown) {
    const formatted = await this.run<unknown>(
      providerName,
      'build-request',
      input,
    );

    if (!isBuildRequestResult(formatted)) {
      throw new InvalidBuildResultError();
    }

    return formatted;
  }

  private async run<TResult>(
    providerName: string,
    operation: string,
    input: unknown,
    query?: unknown,
  ): Promise<TResult> {
    const { definition } = this.resolve(providerName, operation);
    const result = await definition.execute(input, query);

    return (definition.formatResult?.(providerName, result) ??
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
