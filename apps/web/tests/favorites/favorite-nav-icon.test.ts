import { describe, expect, it } from 'vitest';
import {
  ClipboardPenIcon,
  FolderKanban,
  Kanban,
  Layers,
  LayoutDashboard,
  ListTodo,
  Sparkles,
} from '@repo/ui/lib/icons';
import {
  DEFAULT_FAVORITE_NAV_ICON,
  resolveFavoriteNavIcon,
} from '@/lib/favorites/favorite-nav-icon';

describe('resolveFavoriteNavIcon', () => {
  it('maps known area prefixes to sidebar icons from the shared registry', () => {
    expect(resolveFavoriteNavIcon('/projects')).toBe(FolderKanban);
    expect(resolveFavoriteNavIcon('/projects/abc')).toBe(FolderKanban);
    expect(resolveFavoriteNavIcon('/work-items')).toBe(ClipboardPenIcon);
    expect(resolveFavoriteNavIcon('/work-items/abc')).toBe(ClipboardPenIcon);
    expect(resolveFavoriteNavIcon('/backlog')).toBe(ListTodo);
    expect(resolveFavoriteNavIcon('/board')).toBe(Kanban);
    expect(resolveFavoriteNavIcon('/dashboard')).toBe(LayoutDashboard);
    expect(resolveFavoriteNavIcon('/views')).toBe(Layers);
    expect(resolveFavoriteNavIcon('/chat')).toBe(Sparkles);
  });

  it('strips query before matching and falls back for unknown paths', () => {
    expect(resolveFavoriteNavIcon('/projects?tab=1')).toBe(FolderKanban);
    expect(resolveFavoriteNavIcon('/unknown-area')).toBe(
      DEFAULT_FAVORITE_NAV_ICON
    );
  });
});
