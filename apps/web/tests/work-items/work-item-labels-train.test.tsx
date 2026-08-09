import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkItemLabelsTrain } from '@/app/work-items/_components/work-item-labels-train';

describe('WorkItemLabelsTrain', () => {
  it('renders an em dash when there are no labels', () => {
    render(<WorkItemLabelsTrain labels={[]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders label chips', () => {
    render(<WorkItemLabelsTrain labels={['Mobile', 'auth']} />);
    expect(screen.getAllByText('Mobile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('auth').length).toBeGreaterThanOrEqual(1);
  });
});
