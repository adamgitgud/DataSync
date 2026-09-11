import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createDependencies } from '../../app.dependencies';
import { dependencyMiddleware } from './dependencies.middleware';

describe('dependency middleware', () => {
  it('attaches the app graph to request context', async () => {
    const dependencies = createDependencies();
    const app = new Hono<{
      Variables: { dependencies: typeof dependencies };
    }>();
    app.use('*', dependencyMiddleware(dependencies));
    app.get('/', (context) =>
      context.json(context.get('dependencies') === dependencies),
    );
    expect(await (await app.request('/')).json()).toBe(true);
  });
});
