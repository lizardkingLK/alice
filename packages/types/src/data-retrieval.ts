export const DATA_RETRIEVAL_STRATEGIES = ['ssr', 'api'] as const;

export type DataRetrievalStrategy = (typeof DATA_RETRIEVAL_STRATEGIES)[number];

/**
 * Domains that may honor `DATA_READS_VIA_API`. Grow this as Prisma GETs land.
 * The web allowlist should stay in sync.
 */
export const DATA_RETRIEVAL_DOMAINS = ['work-items'] as const;

export type DataRetrievalDomain = (typeof DATA_RETRIEVAL_DOMAINS)[number];
