export function throwInvariant(message: string): never {
  throw new TypeError(message);
}
