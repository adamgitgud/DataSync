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
  clientsController?: ClientsControllerPort;
  clientsService?: ClientsServicePort;
  logger?: AppLogger;
  providers?: readonly ProviderCapabilityPort[];
}

export interface Dependencies {
  clientsController: ClientsControllerPort;
  clientsService: ClientsServicePort;
  logger: AppLogger;
  providerRegistry: ProviderRegistryPort;
}

export function createDependencies(
  overrides: DependencyOverrides = {},
): Dependencies {
  const entries = overrides.providers ?? createBuiltInRegistry();

  const registry: ProviderRegistryPort = {
    find: (name) => {
      const normalisedProviderName = normaliseProviderName(name);

      return entries.find(
        (provider) =>
          normaliseProviderName(provider.name) === normalisedProviderName,
      );
    },
    findOperation: (name, operation) =>
      findProviderOperation(name, operation, entries),
    list: () => providerCapabilities(entries),
  };

  const clientsService =
    overrides.clientsService ?? new ClientsService(registry);

  return {
    clientsController:
      overrides.clientsController ??
      new ClientsController(clientsService, registry),
    clientsService,
    logger: overrides.logger ?? defaultLogger,
    providerRegistry: registry,
  };
}
