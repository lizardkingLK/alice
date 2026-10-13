/** Matches `@repo/ui` DialogContent close animation (`duration-200`). */
export const DIALOG_CLOSE_ANIMATION_MS = 200;

/**
 * Run cleanup after the dialog exit animation finishes.
 * Returns a cancel function — use it from `useEffect` cleanup so a quick
 * re-open does not wipe form state mid-animation.
 */
export function afterDialogClose(callback: () => void): () => void {
  const timer = window.setTimeout(callback, DIALOG_CLOSE_ANIMATION_MS);
  return () => window.clearTimeout(timer);
}
