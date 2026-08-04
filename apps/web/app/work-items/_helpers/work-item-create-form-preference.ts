import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

export type WorkItemCreateFormMode = 'classic' | 'modern';

const STORAGE_KEY = 'alice:work-item-create-form-mode';
const DEFAULT_MODE: WorkItemCreateFormMode = 'classic';

/** Same-tab signal so open create dialogs can refresh after profile changes. */
export const WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT =
  'alice:work-item-create-form-mode-changed';

function isWorkItemCreateFormMode(
  value: unknown
): value is WorkItemCreateFormMode {
  return value === 'classic' || value === 'modern';
}

/**
 * Per-browser preference for work-item create layout.
 * Defaults to classic (labeled fields) when missing or corrupt.
 */
export function readWorkItemCreateFormMode(): WorkItemCreateFormMode {
  const parsed = getLocalStorageJson<unknown>(STORAGE_KEY);
  return isWorkItemCreateFormMode(parsed) ? parsed : DEFAULT_MODE;
}

export function writeWorkItemCreateFormMode(
  mode: WorkItemCreateFormMode
): void {
  setLocalStorageJson(STORAGE_KEY, mode);
  emitWorkItemCreateFormModeChanged();
}

function emitWorkItemCreateFormModeChanged(): void {
  if (globalThis.window === undefined) {
    return;
  }
  globalThis.window.dispatchEvent(
    new CustomEvent(WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT)
  );
}
