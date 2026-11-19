import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjectResourceOptions } from '@/app/work-items/_hooks/use-project-resource-options';

describe('useProjectResourceOptions cache', () => {
  it('reuses a cached fetch for the same scope + project without calling again', async () => {
    const fetchOptions = vi.fn().mockResolvedValue([{ id: 'a', name: 'Ada' }]);

    const first = renderHook(() =>
      useProjectResourceOptions({
        projectId: 'proj-cache-1',
        provided: [],
        selectedId: null,
        cacheScope: 'test-members',
        onSelectionChange: vi.fn(),
        fetchOptions,
      })
    );

    await waitFor(() => {
      expect(first.result.current.isLoading).toBe(false);
    });
    expect(fetchOptions).toHaveBeenCalledTimes(1);
    expect(first.result.current.options).toEqual([{ id: 'a', name: 'Ada' }]);
    first.unmount();

    const second = renderHook(() =>
      useProjectResourceOptions({
        projectId: 'proj-cache-1',
        provided: [],
        selectedId: null,
        cacheScope: 'test-members',
        onSelectionChange: vi.fn(),
        fetchOptions,
      })
    );

    expect(second.result.current.isLoading).toBe(false);
    expect(second.result.current.options).toEqual([{ id: 'a', name: 'Ada' }]);
    expect(fetchOptions).toHaveBeenCalledTimes(1);
    second.unmount();
  });
});
