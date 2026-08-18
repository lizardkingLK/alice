import {
  DATA_RETRIEVAL_DOMAINS,
  type DataRetrievalDomain,
  type DataRetrievalStrategy,
} from '@repo/types';

const TRUTHY = new Set(['true', '1', 'yes']);

const API_DOMAINS = new Set<string>(DATA_RETRIEVAL_DOMAINS);

/** Parse `DATA_READS_VIA_API`. CI always stays on SSR. */
export function parseDataReadsViaApiFlag(
  raw: string | undefined,
  isCi: boolean
): boolean {
  if (isCi) {
    return false;
  }

  if (raw == null) {
    return false;
  }

  return TRUTHY.has(raw.trim().toLowerCase());
}

export function getDataRetrievalStrategy(): DataRetrievalStrategy {
  const viaApi = parseDataReadsViaApiFlag(
    process.env.DATA_READS_VIA_API,
    process.env.GITHUB_ACTIONS === 'true'
  );
  return viaApi ? 'api' : 'ssr';
}

export function isDataRetrievalApiDomain(domain: string): boolean {
  return API_DOMAINS.has(domain);
}

/** App toggle AND this domain has an Express Prisma GET. */
export function shouldReadViaApi(domain: DataRetrievalDomain): boolean {
  return (
    getDataRetrievalStrategy() === 'api' && isDataRetrievalApiDomain(domain)
  );
}
