import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChartWorkspace,
  ensureDefaultChartWorkspace,
  listChartWorkspaces,
  removeChartWorkspace,
  renameChartWorkspaceMeta,
  suggestChartWorkspaceTitle,
} from '@/app/charts/_helpers/charts-workspace-storage';

const memory = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = memory.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    memory.set(key, JSON.stringify(value));
  },
  removeLocalStorageItem: (key: string) => {
    memory.delete(key);
  },
}));

describe('charts-workspace-storage', () => {
  beforeEach(() => {
    memory.clear();
  });

  it('creates a default workspace when none exist', () => {
    const workspace = ensureDefaultChartWorkspace('user-1');
    expect(workspace.title).toBe('Charts');
    expect(listChartWorkspaces('user-1')).toHaveLength(1);
  });

  it('suggests incremental titles and enforces one overview', () => {
    ensureDefaultChartWorkspace('user-1');
    expect(suggestChartWorkspaceTitle('user-1')).toBe('Charts (2)');
    const second = createChartWorkspace('user-1', {
      title: 'Sprint board',
      isOverview: true,
    });
    expect(second.title).toBe('Sprint board');
    expect(second.isOverview).toBe(true);

    const first = listChartWorkspaces('user-1')[0]!;
    renameChartWorkspaceMeta('user-1', first.id, { isOverview: true });

    const list = listChartWorkspaces('user-1');
    expect(list.filter((item) => item.isOverview)).toHaveLength(1);
    expect(list.find((item) => item.id === first.id)?.isOverview).toBe(true);
  });

  it('archives via meta rename and removes workspaces from the local store', () => {
    const first = ensureDefaultChartWorkspace('user-1');
    const second = createChartWorkspace('user-1', { title: 'Charts (2)' });

    renameChartWorkspaceMeta('user-1', first.id, { status: 'archived' });
    expect(
      listChartWorkspaces('user-1', { status: 'archived' }).map(
        (item) => item.id
      )
    ).toEqual([first.id]);
    expect(
      listChartWorkspaces('user-1', { status: 'active' }).map((item) => item.id)
    ).toEqual([second.id]);

    const next = removeChartWorkspace('user-1', second.id);
    expect(next?.id).toBe(first.id);
    expect(listChartWorkspaces('user-1')).toHaveLength(1);
    expect(listChartWorkspaces('user-1')[0]?.id).toBe(first.id);

    expect(removeChartWorkspace('user-1', first.id)).toBeNull();
    expect(listChartWorkspaces('user-1')).toHaveLength(0);
  });
});
