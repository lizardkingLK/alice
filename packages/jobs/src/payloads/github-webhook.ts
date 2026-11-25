import { z } from 'zod';

/** Payload for `github.webhook.ingest` — full event body for later fan-out. */
export const githubWebhookIngestPayloadSchema = z.object({
  deliveryId: z.string().min(1),
  event: z.string().min(1),
  action: z.string().optional(),
  installationId: z.number().int().positive().optional(),
  receivedAt: z.string().min(1),
  payload: z.unknown(),
});

export type GithubWebhookIngestPayload = z.infer<
  typeof githubWebhookIngestPayloadSchema
>;

/** BullMQ `jobId` for idempotent ingest of a GitHub delivery. */
export function githubDeliveryJobId(deliveryId: string): string {
  return `github-delivery-${deliveryId}`;
}
