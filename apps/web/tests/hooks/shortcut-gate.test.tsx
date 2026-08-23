import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useKeyboardShortcut } from '@repo/ui/hooks/use-keyboard-shortcut';
import {
  hasOpenShortcutGate,
  isEditableKeyboardTarget,
  isModKey,
  isShiftLetter,
  isShortcutGateBlocked,
  isUnmodifiedKey,
  shortcutGateContentProps,
} from '@repo/ui/lib/shortcut-gate';

function mountShortcutGate() {
  const node = document.createElement('div');
  for (const [key, value] of Object.entries(shortcutGateContentProps())) {
    node.setAttribute(key, value);
  }
  document.body.appendChild(node);
  return node;
}

function ShiftFHarness({ bypassGate = false }: { bypassGate?: boolean }) {
  const [count, setCount] = useState(0);
  useKeyboardShortcut(
    (event) => isShiftLetter(event, 'f'),
    () => {
      setCount((current) => current + 1);
    },
    { bypassGate }
  );
  return <div data-testid="shortcut-count">{count}</div>;
}

describe('shortcut gate', () => {
  afterEach(() => {
    document
      .querySelectorAll('[data-shortcut-gate]')
      .forEach((node) => node.remove());
  });

  it('treats inputs and editors as editable targets', () => {
    // Arrange
    const input = document.createElement('input');
    const button = document.createElement('button');

    // Act / Assert
    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(button)).toBe(false);
  });

  it('blocks shortcuts when a dialog gate is open', () => {
    // Arrange
    expect(hasOpenShortcutGate()).toBe(false);
    mountShortcutGate();

    // Act / Assert
    expect(hasOpenShortcutGate()).toBe(true);
    expect(isShortcutGateBlocked()).toBe(true);
  });

  it('does not block when bypassGate is set', () => {
    // Arrange
    mountShortcutGate();
    const event = new KeyboardEvent('keydown', { key: 'F', shiftKey: true });

    // Act / Assert
    expect(isShortcutGateBlocked(event, { bypassGate: true })).toBe(false);
  });

  it('matches Shift+F and Ctrl/Meta+K without firing in fields', () => {
    // Arrange
    const shiftF = new KeyboardEvent('keydown', { key: 'F', shiftKey: true });
    const plainF = new KeyboardEvent('keydown', { key: 'f' });
    const modK = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    const plainM = new KeyboardEvent('keydown', { key: 'm' });

    // Act / Assert
    expect(isShiftLetter(shiftF, 'f')).toBe(true);
    expect(isShiftLetter(plainF, 'f')).toBe(false);
    expect(isModKey(modK, 'k')).toBe(true);
    expect(isUnmodifiedKey(plainM, 'm')).toBe(true);
  });

  it('ignores keydown events with a missing key', () => {
    // Arrange — some browsers/extensions emit keydown without `key`
    const broken = {
      key: undefined,
      metaKey: true,
      ctrlKey: false,
      altKey: false,
      repeat: false,
      shiftKey: false,
    } as unknown as KeyboardEvent;

    // Act / Assert
    expect(isModKey(broken, 'b')).toBe(false);
    expect(isShiftLetter(broken, 'f')).toBe(false);
    expect(isUnmodifiedKey(broken, 'm')).toBe(false);
  });

  it('does not run a global shortcut while a form dialog is open', () => {
    // Arrange
    render(<ShiftFHarness />);
    mountShortcutGate();

    // Act
    fireEvent.keyDown(window, { key: 'F', shiftKey: true });

    // Assert
    expect(screen.getByTestId('shortcut-count')).toHaveTextContent('0');
  });

  it('does not run a global shortcut while typing in an input', () => {
    // Arrange
    render(
      <>
        <label htmlFor="title">Title</label>
        <input id="title" />
        <ShiftFHarness />
      </>
    );
    const title = screen.getByLabelText('Title');
    title.focus();

    // Act
    fireEvent.keyDown(title, { key: 'F', shiftKey: true });

    // Assert
    expect(screen.getByTestId('shortcut-count')).toHaveTextContent('0');
  });

  it('runs the shortcut on the page when no dialog is open', () => {
    // Arrange
    render(<ShiftFHarness />);

    // Act
    fireEvent.keyDown(window, { key: 'F', shiftKey: true });

    // Assert
    expect(screen.getByTestId('shortcut-count')).toHaveTextContent('1');
  });
});
