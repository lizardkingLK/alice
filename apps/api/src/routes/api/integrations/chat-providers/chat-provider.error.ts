/** User-facing chat provider failure with an explicit HTTP status for the API route. */
export class ChatProviderError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ChatProviderError';
    this.statusCode = statusCode;
  }
}
