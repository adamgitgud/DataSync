export class OperationNotSupportedError extends Error {
  constructor(
    readonly provider: string,
    readonly operation: string,
  ) {
    super(`Provider ${provider} does not support ${operation}`);
    this.name = 'OperationNotSupportedError';
  }
}

export class InvalidBuildResultError extends Error {
  constructor(message = 'Invalid build-request result') {
    super(message);
    this.name = 'InvalidBuildResultError';
  }
}
