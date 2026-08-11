/** Same-tab signal after Save View succeeds (workspace / future listeners). */
export const SAVED_VIEWS_CHANGED_EVENT = 'alice:saved-views-changed';

export function emitSavedViewsChanged(): void {
  if (globalThis.window === undefined) {
    return;
  }
  globalThis.window.dispatchEvent(new CustomEvent(SAVED_VIEWS_CHANGED_EVENT));
}
