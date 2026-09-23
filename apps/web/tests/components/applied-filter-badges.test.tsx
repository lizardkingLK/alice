import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import {
  AppliedFilterBadges,
  FILTER_BADGE_REMOVE_DEBOUNCE_MS,
  appliedFilterLabelChipId,
  parseAppliedFilterLabelChipId,
  type AppliedFilterBadgeItem,
} from '@/components/applied-filter-badges';

const defaultItems: AppliedFilterBadgeItem[] = [
  { id: 'search', fieldId: 'search', label: 'login bug' },
  {
    id: appliedFilterLabelChipId('a'),
    fieldId: 'labels',
    label: 'a',
  },
  {
    id: appliedFilterLabelChipId('b'),
    fieldId: 'labels',
    label: 'b',
  },
  {
    id: appliedFilterLabelChipId('c'),
    fieldId: 'labels',
    label: 'c',
  },
];

function renderBadges(
  props: Partial<ComponentProps<typeof AppliedFilterBadges>> = {}
) {
  const onRemove = vi.fn();
  const onClearAll = vi.fn();
  const view = render(
    <TooltipProvider>
      <AppliedFilterBadges
        items={defaultItems}
        onRemove={onRemove}
        onClearAll={onClearAll}
        {...props}
      />
    </TooltipProvider>
  );
  return { onRemove, onClearAll, ...view };
}

describe('AppliedFilterBadges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no items', () => {
    const { container } = render(
      <TooltipProvider>
        <AppliedFilterBadges
          items={[]}
          onRemove={vi.fn()}
          onClearAll={vi.fn()}
        />
      </TooltipProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('optimistically hides chips and flushes one batched onRemove after debounce', () => {
    const { onRemove } = renderBadges();

    fireEvent.click(screen.getByRole('button', { name: /Remove filter a/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove filter b/i }));
    fireEvent.click(screen.getByRole('button', { name: /Remove filter c/i }));

    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.queryByText('b')).not.toBeInTheDocument();
    expect(screen.queryByText('c')).not.toBeInTheDocument();
    expect(screen.getByText('login bug')).toBeInTheDocument();
    expect(onRemove).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(FILTER_BADGE_REMOVE_DEBOUNCE_MS);
    });

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith([
      appliedFilterLabelChipId('a'),
      appliedFilterLabelChipId('b'),
      appliedFilterLabelChipId('c'),
    ]);
  });

  it('flushes a second batch when the user pauses between bursts', () => {
    const { onRemove } = renderBadges();

    fireEvent.click(screen.getByRole('button', { name: /Remove filter a/i }));
    act(() => {
      vi.advanceTimersByTime(FILTER_BADGE_REMOVE_DEBOUNCE_MS);
    });
    expect(onRemove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Remove filter b/i }));
    act(() => {
      vi.advanceTimersByTime(FILTER_BADGE_REMOVE_DEBOUNCE_MS);
    });
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(onRemove).toHaveBeenLastCalledWith([appliedFilterLabelChipId('b')]);
  });

  it('encodes and parses label chip ids', () => {
    expect(appliedFilterLabelChipId('Mobile')).toBe('labels:Mobile');
    expect(parseAppliedFilterLabelChipId('labels:Mobile')).toBe('Mobile');
    expect(parseAppliedFilterLabelChipId('project')).toBeNull();
  });
});
