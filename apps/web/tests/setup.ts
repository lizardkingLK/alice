import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';

process.env.NEXT_PUBLIC_API_URL ||= 'http://localhost:3000';
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.NEXT_PUBLIC_PUSHER_KEY ||= 'test-pusher-key';
process.env.NEXT_PUBLIC_PUSHER_CLUSTER ||= 'mt1';

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
