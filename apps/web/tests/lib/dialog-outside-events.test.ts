import { describe, expect, it } from 'vitest';
import { isFloatingPortalEventTarget } from '@/lib/dialog-outside-events';

describe('isFloatingPortalEventTarget', () => {
  it('treats Sonner toast nodes as floating portals', () => {
    const toaster = document.createElement('div');
    toaster.setAttribute('data-sonner-toaster', '');
    const toast = document.createElement('div');
    toast.setAttribute('data-sonner-toast', '');
    toaster.appendChild(toast);
    document.body.appendChild(toaster);

    expect(isFloatingPortalEventTarget(toast)).toBe(true);
    expect(isFloatingPortalEventTarget(toaster)).toBe(true);

    toaster.remove();
  });

  it('returns false for ordinary dialog content', () => {
    const node = document.createElement('div');
    node.setAttribute('data-slot', 'dialog-content');
    document.body.appendChild(node);

    expect(isFloatingPortalEventTarget(node)).toBe(false);

    node.remove();
  });
});
