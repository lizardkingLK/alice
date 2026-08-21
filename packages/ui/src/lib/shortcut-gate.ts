export const SHORTCUT_GATE_OPEN_VALUE = 'open';
export const SHORTCUT_GATE_SELECTOR = '[data-shortcut-gate="open"]';

export function shortcutGateContentProps() {
  return { 'data-shortcut-gate': SHORTCUT_GATE_OPEN_VALUE } as const;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  if (EDITABLE_TAGS.has(target.tagName)) {
    return true;
  }
  return Boolean(target.closest('[contenteditable="true"], [role="textbox"]'));
}

export function hasOpenShortcutGate(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return Boolean(document.querySelector(SHORTCUT_GATE_SELECTOR));
}

export function isShortcutGateBlocked(
  event?: KeyboardEvent,
  options?: { bypassGate?: boolean }
): boolean {
  if (options?.bypassGate) {
    return false;
  }
  if (event && isEditableKeyboardTarget(event.target)) {
    return true;
  }
  return hasOpenShortcutGate();
}

export function isModKey(event: KeyboardEvent, key: string): boolean {
  return (
    event.key.toLowerCase() === key.toLowerCase() &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.repeat
  );
}

export function isShiftLetter(event: KeyboardEvent, letter: string): boolean {
  return (
    event.shiftKey &&
    event.key.toLowerCase() === letter.toLowerCase() &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.repeat
  );
}

export function isUnmodifiedKey(event: KeyboardEvent, key: string): boolean {
  return (
    event.key.toLowerCase() === key.toLowerCase() &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.repeat
  );
}
