import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = store.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
    return true;
  },
}));

import {
  addFocusTodo,
  clearCompletedFocusTodos,
  filterFocusTodos,
  focusFilterEmptyMessage,
  FOCUS_TODOS_MAX,
  readFocusTodos,
  removeFocusTodo,
  reorderFocusTodos,
  toggleFocusTodo,
  writeFocusTodos,
} from '@/app/dashboard/_helpers/focus-todos';

describe('focus todos', () => {
  beforeEach(() => {
    store.clear();
  });

  it('round-trips todos for a user', () => {
    const seeded = addFocusTodo([], 'Ship Focus widget');
    writeFocusTodos('user-1', seeded);
    expect(readFocusTodos('user-1')).toEqual(seeded);
  });

  it('appends new tasks at the end', () => {
    let todos = addFocusTodo([], 'One');
    todos = addFocusTodo(todos, 'Two');
    expect(todos.map((todo) => todo.text)).toEqual(['One', 'Two']);
  });

  it('toggles, removes, and clears completed', () => {
    let todos = addFocusTodo([], 'One');
    todos = addFocusTodo(todos, 'Two');
    const firstId = todos[0]!.id;
    todos = toggleFocusTodo(todos, firstId);
    expect(todos.find((todo) => todo.id === firstId)?.done).toBe(true);
    todos = clearCompletedFocusTodos(todos);
    expect(todos).toHaveLength(1);
    todos = removeFocusTodo(todos, todos[0]!.id);
    expect(todos).toHaveLength(0);
  });

  it('filters by all, active, and done', () => {
    let todos = addFocusTodo([], 'One');
    todos = addFocusTodo(todos, 'Two');
    todos = toggleFocusTodo(todos, todos[0]!.id);
    expect(filterFocusTodos(todos, 'all')).toHaveLength(2);
    expect(filterFocusTodos(todos, 'active').map((todo) => todo.text)).toEqual([
      'Two',
    ]);
    expect(filterFocusTodos(todos, 'done').map((todo) => todo.text)).toEqual([
      'One',
    ]);
  });

  it('returns empty-state copy for each filter', () => {
    expect(focusFilterEmptyMessage(0, 'active')).toMatch(/Capture quick tasks/);
    expect(focusFilterEmptyMessage(2, 'done')).toBe('No completed tasks.');
    expect(focusFilterEmptyMessage(2, 'active')).toBe('No active tasks.');
    expect(focusFilterEmptyMessage(2, 'all')).toBe('No tasks.');
  });

  it('reorders by drag target edge', () => {
    let todos = addFocusTodo([], 'One');
    todos = addFocusTodo(todos, 'Two');
    todos = addFocusTodo(todos, 'Three');
    const [one, two, three] = todos;
    todos = reorderFocusTodos(todos, three!.id, one!.id, 'before');
    expect(todos.map((todo) => todo.text)).toEqual(['Three', 'One', 'Two']);
    todos = reorderFocusTodos(todos, one!.id, two!.id, 'after');
    expect(todos.map((todo) => todo.text)).toEqual(['Three', 'Two', 'One']);
  });

  it('ignores blank text and respects the max length', () => {
    expect(addFocusTodo([], '   ')).toHaveLength(0);
    let todos = [] as ReturnType<typeof addFocusTodo>;
    for (let index = 0; index < FOCUS_TODOS_MAX + 5; index += 1) {
      todos = addFocusTodo(todos, `Task ${index}`);
    }
    expect(todos).toHaveLength(FOCUS_TODOS_MAX);
  });
});
