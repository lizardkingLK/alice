import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeWipPanel } from '@/app/_components/home/home-wip-panel';
import type { HomeLaunchpadWorkItem } from '@/app/_components/home/home-launchpad.types';

const sampleItem: HomeLaunchpadWorkItem = {
  id: 'wi-1',
  title: 'Ship launchpad',
  slug: 'ship-launchpad',
  status: 'InProgress',
  projectKey: 'THIS',
  updatedAt: '2026-11-10T00:00:00.000Z',
};

describe('HomeWipPanel', () => {
  it('hides when there are no items', () => {
    const { container } = render(
      <HomeWipPanel
        items={[]}
        completion={{ doneCount: 0, totalCount: 0, percent: 0 }}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the completion percent pill with inbox-style WIP rows on glass', () => {
    const { container } = render(
      <HomeWipPanel
        items={[sampleItem]}
        completion={{ doneCount: 1, totalCount: 4, percent: 25 }}
      />
    );
    expect(screen.getByText('25% completed')).toBeInTheDocument();
    expect(screen.getByText('Ship launchpad')).toBeInTheDocument();
    expect(screen.getByText('THIS')).toBeInTheDocument();
    expect(container.querySelector('.dashboard-widget-glass')).not.toBeNull();
  });
});
