import { fireEvent, waitFor } from '@testing-library/react';
import { expect, type Mock } from 'vitest';

type DebouncedSearchAssertOptions = {
  readonly searchInput: HTMLElement;
  readonly value: string;
  readonly expectedPath: string;
  readonly mockPush: Mock;
  readonly debounceMs?: number;
};

/** Wait for debounced search navigation (real timers; avoids fake-timer leaks). */
export async function assertDebouncedSearchRedirect({
  searchInput,
  value,
  expectedPath,
  mockPush,
  debounceMs = 400,
}: DebouncedSearchAssertOptions) {
  fireEvent.change(searchInput, { target: { value } });

  await waitFor(
    () => {
      expect(mockPush).toHaveBeenCalledWith(expectedPath);
    },
    { timeout: debounceMs + 600 }
  );
}
