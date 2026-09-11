import type {
  ClientsServicePort,
  BuildRequestResult,
  ProviderRegistryPort,
  ProviderCapabilityPort,
  ProviderOperationDefinition,
} from './clients.interfaces';
import { providerOperation } from './clients.interfaces';
import {
  InvalidBuildResultError,
  OperationNotSupportedError,
} from '../common/errors/domain.error';
import { parseInput } from '../common/validation/input-validation';
import { canonicalClientSchema } from './schemas/canonical-client.schema';
import { isRecord } from '../common/validation/source';

interface ResolvedProviderOperation {
  provider: ProviderCapabilityPort;
  definition: ProviderOperationDefinition;
}

function isBuildRequestResult(value: unknown): value is BuildRequestResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isRecord(value['request']) &&
    isRecord(value['response']) &&
    value['response']['simulated'] === true &&
    Array.isArray(value['warnings'])
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
  ): Promise<unknown> {
    return this.run(providerName, operation, input);
  }

  async normalise(providerName: string, input: unknown) {
    return parseInput(
      canonicalClientSchema,
      await this.run(providerName, 'normalise', input),
    );
  }

  async buildRequest(providerName: string, input: unknown) {
    const formatted = await this.run(providerName, 'build-request', input);

    if (!isBuildRequestResult(formatted)) {
      throw new InvalidBuildResultError();
    }

    return formatted;
  }

  private async run(providerName: string, operation: string, input: unknown) {
    const { definition } = this.resolve(providerName, operation);
    const result = await definition.execute(input);

    return definition.formatResult?.(providerName, result) ?? result;
  }

  private resolve(
    providerName: string,
    operation: string,
  ): ResolvedProviderOperation {
    const provider = this.providerRegistry.find(providerName);
    const definition =
      provider === undefined
        ? undefined
        : providerOperation(provider, operation);

    if (provider === undefined || definition === undefined) {
      throw new OperationNotSupportedError(providerName, operation);
    }

    return { provider, definition };
  }
}
