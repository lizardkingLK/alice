/**
 * Portaled Combobox content sits under `document.body`. Radix Dialog sets
 * `pointer-events: none` on body while open, so option clicks are reported as
 * "outside" dismiss events unless we ignore them.
 */
export function isComboboxPortalEventTarget(
  target: EventTarget | null
): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-slot=combobox-content]'))
  );
}

/** Keep a Radix Dialog open when the user interacts with a Combobox popup. */
export function preventDismissForComboboxPortal(event: {
  readonly target: EventTarget | null;
  preventDefault: () => void;
}): void {
  if (isComboboxPortalEventTarget(event.target)) {
    event.preventDefault();
  }
}
