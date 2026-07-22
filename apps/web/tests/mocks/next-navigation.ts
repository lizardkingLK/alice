import { vi, type Mock } from 'vitest';

export const mockPush: Mock = vi.fn();
export const mockRefresh: Mock = vi.fn();
export const mockReplace: Mock = vi.fn();

let pathname = '/work-items';
let searchParams: Record<string, string> = {};

export function configureNextNavigationMock(options?: {
  pathname?: string;
  searchParams?: Record<string, string>;
}) {
  if (options?.pathname !== undefined) {
    pathname = options.pathname;
  }
  if (options?.searchParams !== undefined) {
    searchParams = options.searchParams;
  }
}

export function resetNextNavigationMock() {
  pathname = '/work-items';
  searchParams = {};
  mockPush.mockReset();
  mockRefresh.mockReset();
  mockReplace.mockReset();
}

export function useRouter() {
  return {
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
  };
}

export function usePathname() {
  return pathname;
}

export function useSearchParams() {
  return {
    get: (key: string) => searchParams[key] ?? null,
    toString: () => new URLSearchParams(searchParams).toString(),
  };
}
