export class WorkflowConfigError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status = 400,
    options?: {
      readonly code?: string;
      readonly details?: unknown;
    }
  ) {
    super(message);
    this.name = 'WorkflowConfigError';
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }
}
