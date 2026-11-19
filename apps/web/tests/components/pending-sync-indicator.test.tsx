import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PendingSyncIndicator } from '@/components/pending-sync-indicator';

describe('PendingSyncIndicator', () => {
  it('renders nothing when inactive', () => {
    const { container } = render(<PendingSyncIndicator active={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Saving… status when active', () => {
    render(<PendingSyncIndicator active />);
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  });

  it('supports a custom label', () => {
    render(<PendingSyncIndicator active label="Syncing…" />);
    expect(screen.getByRole('status')).toHaveTextContent('Syncing…');
  });
});
