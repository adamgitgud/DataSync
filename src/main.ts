import { serve } from '@hono/node-server';
import { pathToFileURL } from 'node:url';
import { app } from './app';

export interface CloseableServer {
  close(): void;
}

export function announceListening(info: { port: number }) {
  console.log(`DataSync listening on http://${resolveHost()}:${info.port}`);
}

export function registerShutdownHandlers(server: CloseableServer) {
  const handlers = new Map<string, VoidFunction>();

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    const handler = () => server.close();

    process.once(signal, handler);
    handlers.set(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
}

export function resolveHost() {
  return process.env['HOST'] ?? '127.0.0.1';
}

export function startServer(
  port = Number(process.env['PORT'] ?? 3000),
  hostname = resolveHost(),
) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const server = serve({ fetch: app.fetch, hostname, port }, announceListening);

  registerShutdownHandlers(server);

  return server;
}

const invokedPath = process.argv[1];

if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  startServer();
}
