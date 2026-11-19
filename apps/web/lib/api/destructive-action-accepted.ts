/** Shared 202 Accepted body for async archive / hard-purge mutations. */
export type DestructiveActionAccepted = {
  readonly accepted: true;
  readonly message: string;
  readonly correlationId: string;
};
