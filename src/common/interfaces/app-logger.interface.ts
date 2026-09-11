export interface AppLogger {
  error(
    message: string,
    context: { path: string; method: string; error?: unknown },
  ): void;
}
