import { describe, expect, it } from 'vitest';
import {
  announceListening,
  registerShutdownHandlers,
  startServer,
} from './main';

describe('startServer', () => {
  it.each([0, -1, 65536, 3000.5, Number.NaN])(
    'rejects invalid port %j without starting a listener',
    (port) => {
      expect(() => startServer(port)).toThrow(
        'PORT must be an integer between 1 and 65535',
      );
    },
  );

  it('announces a listening port and registers both shutdown signals', () => {
    announceListening({ port: 31337 });
    let closes = 0;
    const dispose = registerShutdownHandlers({ close: () => closes++ });
    process.emit('SIGINT');
    process.emit('SIGTERM');
    expect(closes).toBe(2);
    dispose();
  });
});
