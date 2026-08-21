'use client';

import * as React from 'react';
import { isShortcutGateBlocked } from '../lib/shortcut-gate';

type UseKeyboardShortcutOptions = {
  enabled?: boolean;
  /**
   * Run even when a dialog/sheet is open or focus is in a field.
   * Use when this shortcut owns the open overlay (toggle close).
   */
  bypassGate?: boolean;
};

export function useKeyboardShortcut(
  isMatch: (event: KeyboardEvent) => boolean,
  onMatch: (event: KeyboardEvent) => void,
  { enabled = true, bypassGate = false }: UseKeyboardShortcutOptions = {}
) {
  const isMatchRef = React.useRef(isMatch);
  const onMatchRef = React.useRef(onMatch);
  isMatchRef.current = isMatch;
  onMatchRef.current = onMatch;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isMatchRef.current(event)) {
        return;
      }
      if (isShortcutGateBlocked(event, { bypassGate })) {
        return;
      }
      onMatchRef.current(event);
    };

    globalThis.window.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, bypassGate]);
}

type UseToggleKeyboardShortcutOptions = {
  enabled?: boolean;
};

/** Toggle `open` state; bypasses the gate while this overlay is open. */
export function useToggleKeyboardShortcut(
  isMatch: (event: KeyboardEvent) => boolean,
  open: boolean,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>,
  { enabled = true }: UseToggleKeyboardShortcutOptions = {}
) {
  useKeyboardShortcut(
    isMatch,
    (event) => {
      event.preventDefault();
      setOpen((current) => !current);
    },
    { enabled, bypassGate: open }
  );
}
