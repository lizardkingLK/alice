import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProjectsPage from '@/app/projects/page';

vi.mock('@/app/projects/_components/projects-data', () => ({
  ProjectsData: () => <div data-testid="projects-data">Projects Data Content</div>,
}));

vi.mock('@/components/registry-page-shell', () => ({
  REGISTRY_PAGES: {
    projects: {
      description: 'Organize project administration.',
      skeleton: { columnCount: 6, rowCount: 8, showTabs: true },
    },
  },
  RegistrySuspensePage: ({
    children,
  }: {
    readonly children: React.ReactNode;
  }) => <div data-testid="registry-suspense-page">{children}</div>,
}));

describe('ProjectsPage', () => {
  it('renders successfully without throwing notFound', async () => {
    render(<ProjectsPage searchParams={Promise.resolve({})} />);
    expect(screen.getByTestId('registry-suspense-page')).toBeInTheDocument();
    expect(screen.getByTestId('projects-data')).toBeInTheDocument();
  });
});
