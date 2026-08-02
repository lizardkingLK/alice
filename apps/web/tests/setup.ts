import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

vi.mock('@/components/optimistic-lock/optimistic-lock-provider', () => ({
  useOptimisticLock: () => ({
    handleMutationError: vi.fn().mockReturnValue(false),
    openConflict: vi.fn(),
    clearPending: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});
