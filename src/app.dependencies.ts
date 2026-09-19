import { ClientsService } from './clients/clients.service';
import type {
  ClientsServicePort,
  ProviderCapabilityPort,
  ProviderRegistryPort,
  ClientsControllerPort,
} from './clients/clients.interfaces';
import {
  createBuiltInRegistry,
  findProviderOperation,
  normaliseProviderName,
  providerCapabilities,
} from './integrations/provider.registry';
import { ClientsController } from './clients/clients.controller';
import type { AppLogger } from './common/interfaces/app-logger.interface';

const defaultLogger: AppLogger = {
  error: (message, context) => console.error(message, context),
};

export interface DependencyOverrides {
  providers?: readonly ProviderCapabilityPort[];
  clientsService?: ClientsServicePort;
  logger?: AppLogger;
  clientsController?: ClientsControllerPort;
}

export interface Dependencies {
  providerRegistry: ProviderRegistryPort;
  clientsService: ClientsServicePort;
  logger: AppLogger;
  clientsController: ClientsControllerPort;
}

export function createDependencies(
  overrides: DependencyOverrides = {},
): Dependencies {
  const entries = overrides.providers ?? createBuiltInRegistry();

  const registry: ProviderRegistryPort = {
    list: () => providerCapabilities(entries),
    find: (name) => {
      const normalisedProviderName = normaliseProviderName(name);

      return entries.find(
        (provider) =>
          normaliseProviderName(provider.name) === normalisedProviderName,
      );
    },
    findOperation: (name, operation) =>
      findProviderOperation(name, operation, entries),
  };

  const clientsService =
    overrides.clientsService ?? new ClientsService(registry);

  return {
    providerRegistry: registry,
    clientsService,
    logger: overrides.logger ?? defaultLogger,
    clientsController:
      overrides.clientsController ??
      new ClientsController(clientsService, registry),
  };
}
