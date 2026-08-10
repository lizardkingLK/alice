/** Matches `@repo/ui` DialogContent close animation (`duration-200`). */
export const DIALOG_CLOSE_ANIMATION_MS = 200;

/** Run cleanup after the dialog exit animation finishes. */
export function afterDialogClose(callback: () => void): void {
  window.setTimeout(callback, DIALOG_CLOSE_ANIMATION_MS);
}
