import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('importable HTTP app', () => {
  it('returns a structured 404 for an unknown route', async () => {
    const response = await app.request('/does-not-exist');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });
});
