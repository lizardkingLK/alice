export type EmailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly idempotencyKey: string;
};

export interface EmailTransport {
  send(message: EmailMessage): Promise<void>;
}

export class EmailTransportError extends Error {
  constructor(
    message: string,
    readonly details: {
      readonly kind: 'http' | 'timeout' | 'network' | 'configuration';
      readonly status?: number;
    }
  ) {
    super(message);
    this.name = 'EmailTransportError';
  }
}
