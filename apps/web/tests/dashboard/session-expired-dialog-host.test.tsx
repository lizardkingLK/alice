import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { SessionExpiredDialogHost } from '@/app/dashboard/_components/session-expired-dialog-host';
import {
  emitSessionExpired,
  SESSION_EXPIRED_EVENT,
} from '@/lib/errors/session-expired';

describe('SessionExpiredDialogHost', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('portals an interactive overlay above modal stacking (z-100 + pointer-events-auto)', async () => {
    render(<SessionExpiredDialogHost />);

    emitSessionExpired('/login?next=%2Fcharts');

    const overlay = await screen.findByRole('alertdialog');
    const shell = overlay.parentElement;
    expect(shell).toHaveAttribute('data-session-expired-overlay');
    expect(shell).toHaveClass('pointer-events-auto', 'z-100');
    expect(overlay).toHaveClass('pointer-events-auto', 'z-100');
    expect(
      screen.getByRole('button', { name: /^Sign in$/i })
    ).toBeInTheDocument();
  });

  it('navigates with a full page assign when Sign in is clicked', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...globalThis.location,
      assign,
    });

    render(<SessionExpiredDialogHost />);
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRED_EVENT, {
        detail: { loginPath: '/login?next=%2Fdashboard' },
      })
    );

    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: /^Sign in$/i }));

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('/login?next=%2Fdashboard');
    });
  });
});
