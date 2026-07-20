export interface RawSearchParams {
  page?: string;
  limit?: string;
  tab?: string;
  search?: string;
}

export interface ParsedStandardParams {
  page: number;
  limit: number;
  search: string;
}

export function parseStandardParams(
  resolvedParams: RawSearchParams,
  defaultLimit = 10
): ParsedStandardParams {
  const page = Number.parseInt(resolvedParams.page ?? '1', 10);
  const limit = Number.parseInt(
    resolvedParams.limit ?? String(defaultLimit),
    10
  );
  const search = resolvedParams.search ?? '';
  return { page, limit, search };
}

export function parseTabStatus(tab?: string): 'active' | 'archived' {
  return tab === 'archived' ? 'archived' : 'active';
}

export function parseManagerTabStatus(
  tab?: string
): 'active' | 'inactive' | 'archived' {
  if (tab === 'archived') return 'archived';
  if (tab === 'inactive') return 'inactive';
  return 'active';
}
