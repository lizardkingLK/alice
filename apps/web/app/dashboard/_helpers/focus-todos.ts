/**
 * Per-user Focus widget todos (browser localStorage only).
 * Today's rows sync with the personal Calendar widget.
 */

import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:overview-focus-todos:v1:';
export const FOCUS_TODOS_CHANGED_EVENT = 'alice-focus-todos-changed';
export const FOCUS_TODOS_MAX = 50;

export type FocusTodo = {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
  readonly createdAt: number;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function newTodoId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (b) =>
      b.toString(16).padStart(2, '0')
    ).join('');
    return `todo-${Date.now()}-${suffix}`;
  }
  return `todo-${Date.now()}`;
}

function normalizeTodo(value: unknown): FocusTodo | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id.length === 0) {
    return null;
  }
  if (typeof row.text !== 'string') {
    return null;
  }
  const text = row.text.trim();
  if (!text) {
    return null;
  }
  return {
    id: row.id,
    text,
    done: row.done === true,
    createdAt:
      typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
        ? row.createdAt
        : Date.now(),
  };
}

export function readFocusTodos(userId: string | null | undefined): FocusTodo[] {
  if (!userId) {
    return [];
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (!Array.isArray(raw)) {
    return [];
  }
  const todos: FocusTodo[] = [];
  for (const entry of raw) {
    const todo = normalizeTodo(entry);
    if (todo) {
      todos.push(todo);
    }
    if (todos.length >= FOCUS_TODOS_MAX) {
      break;
    }
  }
  return todos;
}

export function writeFocusTodos(
  userId: string | null | undefined,
  todos: readonly FocusTodo[]
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(
    storageKey(userId),
    todos.slice(0, FOCUS_TODOS_MAX).map((todo) => ({
      id: todo.id,
      text: todo.text,
      done: todo.done,
      createdAt: todo.createdAt,
    }))
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FOCUS_TODOS_CHANGED_EVENT));
  }
}

/** Stable compare for skip-write guards during Focus ↔ Calendar sync. */
export function focusTodosFingerprint(todos: readonly FocusTodo[]): string {
  return todos
    .map((todo) => `${todo.id}\0${todo.done ? 1 : 0}\0${todo.text}`)
    .join('\n');
}

export type FocusTodoFilter = 'all' | 'active' | 'done';

export type FocusTodoDropEdge = 'before' | 'after';

export function addFocusTodo(
  todos: readonly FocusTodo[],
  text: string
): FocusTodo[] {
  const trimmed = text.trim();
  if (!trimmed || todos.length >= FOCUS_TODOS_MAX) {
    return [...todos];
  }
  return [
    ...todos,
    {
      id: newTodoId(),
      text: trimmed,
      done: false,
      createdAt: Date.now(),
    },
  ];
}

export function toggleFocusTodo(
  todos: readonly FocusTodo[],
  id: string
): FocusTodo[] {
  return todos.map((todo) =>
    todo.id === id ? { ...todo, done: !todo.done } : todo
  );
}

export function removeFocusTodo(
  todos: readonly FocusTodo[],
  id: string
): FocusTodo[] {
  return todos.filter((todo) => todo.id !== id);
}

export function clearCompletedFocusTodos(
  todos: readonly FocusTodo[]
): FocusTodo[] {
  return todos.filter((todo) => !todo.done);
}

export function filterFocusTodos(
  todos: readonly FocusTodo[],
  filter: FocusTodoFilter
): FocusTodo[] {
  if (filter === 'active') {
    return todos.filter((todo) => !todo.done);
  }
  if (filter === 'done') {
    return todos.filter((todo) => todo.done);
  }
  return [...todos];
}

/** Empty-state copy for the Focus task list (avoids nested ternaries in UI). */
export function focusFilterEmptyMessage(
  totalCount: number,
  filter: FocusTodoFilter
): string {
  if (totalCount === 0) {
    return 'Capture quick tasks for this focus block.';
  }
  if (filter === 'done') {
    return 'No completed tasks.';
  }
  if (filter === 'active') {
    return 'No active tasks.';
  }
  return 'No tasks.';
}

/** Reorder by drag target; no-op when ids are missing or identical. */
export function reorderFocusTodos(
  todos: readonly FocusTodo[],
  draggedId: string,
  targetId: string,
  edge: FocusTodoDropEdge
): FocusTodo[] {
  if (draggedId === targetId) {
    return [...todos];
  }
  const next = [...todos];
  const from = next.findIndex((todo) => todo.id === draggedId);
  let to = next.findIndex((todo) => todo.id === targetId);
  if (from < 0 || to < 0) {
    return next;
  }
  const [item] = next.splice(from, 1);
  if (!item) {
    return [...todos];
  }
  if (from < to) {
    to -= 1;
  }
  const insertAt = edge === 'after' ? to + 1 : to;
  next.splice(insertAt, 0, item);
  return next;
}
