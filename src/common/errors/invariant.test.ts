import { describe, expect, it } from 'vitest';
import { throwInvariant } from './invariant';

describe('throwInvariant', () => {
  it('throws a TypeError with the given message', () => {
    expect(() => throwInvariant('Missing value')).toThrow(TypeError);
    expect(() => throwInvariant('Missing value')).toThrow('Missing value');
  });
});
