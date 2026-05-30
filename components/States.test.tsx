import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardListSkeleton, SkeletonBlock } from './States';

describe('skeleton states', () => {
  it('renders decorative blocks hidden from assistive technology', () => {
    render(<SkeletonBlock />);

    expect(screen.getByTestId('skeleton-block')).toHaveAttribute('aria-hidden', 'true');
  });

  it('announces card list loading without exposing decorative shapes', () => {
    render(<CardListSkeleton count={2} label="Cargando tarjetas..." />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Cargando tarjetas...')).toHaveClass('sr-only');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
