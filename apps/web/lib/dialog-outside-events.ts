/**
 * Portaled floating UI (Select / Combobox / Dropdown / Popover) mounts under
 * `document.body`. While a Dialog (or outer Popover) is open, Radix treats
 * those nodes as "outside", so option clicks — and re-clicking a Select /
 * menu trigger to close it — can dismiss the parent unless we ignore them.
 */

/** Layers that live outside the parent and should never count as dismiss. */
const FLOATING_PORTAL_TARGET_SELECTOR = [
  '[data-slot="select-content"]',
  '[data-slot="select-trigger"]',
  '[data-slot="combobox-content"]',
  '[data-slot="popover-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  '[data-radix-popper-content-wrapper]',
  '[data-radix-select-viewport]',
  '[data-radix-select-trigger]',
  '[role="listbox"]',
].join(',');

/**
 * Nested dismissable layers that, while mounted, mean a pointer/focus event
 * is likely closing that layer — not the parent Dialog/Popover.
 * Intentionally excludes `popover-content` so an outer filter Popover can
 * still close when clicking its own outside area.
 */
const NESTED_OPEN_LAYER_SELECTOR = [
  '[data-slot="select-content"]',
  '[data-slot="combobox-content"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  '[data-radix-select-viewport]',
  '[role="listbox"]',
].join(',');

export function isFloatingPortalEventTarget(
  target: EventTarget | null
): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(FLOATING_PORTAL_TARGET_SELECTOR))
  );
}

/** True while a nested Select / Combobox / Dropdown layer is mounted. */
export function hasOpenNestedFloatingLayer(): boolean {
  return Boolean(document.querySelector(NESTED_OPEN_LAYER_SELECTOR));
}

/**
 * Keep a Radix Dialog / Popover open when the user interacts with nested
 * portaled UI (Select, Dropdown, Combobox, nested Popover content).
 */
export function preventDismissForFloatingPortal(event: {
  readonly target: EventTarget | null;
  preventDefault: () => void;
}): void {
  if (
    isFloatingPortalEventTarget(event.target) ||
    hasOpenNestedFloatingLayer()
  ) {
    event.preventDefault();
  }
}

/** @deprecated Prefer {@link isFloatingPortalEventTarget}. */
export function isComboboxPortalEventTarget(
  target: EventTarget | null
): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('[data-slot=combobox-content]'))
  );
}

/** @deprecated Prefer {@link preventDismissForFloatingPortal}. */
export function preventDismissForComboboxPortal(event: {
  readonly target: EventTarget | null;
  preventDefault: () => void;
}): void {
  preventDismissForFloatingPortal(event);
}
