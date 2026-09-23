import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { HoverChipTrain } from '@/components/hover-chip-train';

describe('HoverChipTrain', () => {
  let resizeCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    resizeCallback = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          resizeCallback = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function paintOverflow(viewportWidth: number, stripWidth: number) {
    const viewport = document.querySelector(
      '[data-slot="hover-chip-train"]'
    ) as HTMLElement;
    Object.defineProperty(viewport, 'clientWidth', {
      configurable: true,
      value: viewportWidth,
    });
    const measure = viewport.querySelector(
      '[data-slot="hover-chip-train-measure"]'
    ) as HTMLElement;
    Object.defineProperty(measure, 'scrollWidth', {
      configurable: true,
      value: stripWidth,
    });
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });
    return viewport;
  }

  it('keeps a single strip when content fits', () => {
    render(
      <HoverChipTrain className="w-36" contentKey="fits">
        <div data-testid="strip">chip</div>
      </HoverChipTrain>
    );

    const viewport = paintOverflow(200, 80);

    expect(viewport).toHaveAttribute('data-overflows', 'false');
    // measure (hidden) + visible = 2
    expect(screen.getAllByTestId('strip')).toHaveLength(2);
  });

  it('duplicates the strip and trains on hover when content overflows', () => {
    render(
      <HoverChipTrain className="w-36" contentKey="wide" title="chips">
        <div data-testid="strip">long-chip-strip</div>
      </HoverChipTrain>
    );

    const viewport = paintOverflow(100, 400);

    expect(viewport).toHaveAttribute('data-overflows', 'true');
    // measure + primary + duplicate
    expect(screen.getAllByTestId('strip')).toHaveLength(3);

    fireEvent.mouseEnter(viewport);
    expect(viewport.querySelector('.animate-labels-train')).toBeInTheDocument();

    fireEvent.mouseLeave(viewport);
    expect(viewport.querySelector('.animate-labels-train')).toBeNull();
  });
});
