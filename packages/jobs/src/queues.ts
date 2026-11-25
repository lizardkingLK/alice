/** BullMQ queue names — split by failure / concurrency profile. */
export const QUEUE_NAMES = {
  default: 'default',
  aiAgent: 'ai-agent',
  aiTools: 'ai-tools',
  heavy: 'heavy',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
