export interface AppLogger {
  error(
    message: string,
    context: { error?: unknown; method: string; path: string },
  ): void;
}
