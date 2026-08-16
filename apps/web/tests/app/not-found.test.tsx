import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFound from '@/app/not-found';

describe('NotFound', () => {
  it('renders a 404 heading and a home link', () => {
    render(<NotFound />);

    expect(
      screen.getByRole('heading', { name: /Page not found/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to home/i })).toHaveAttribute(
      'href',
      '/'
    );
  });
});
