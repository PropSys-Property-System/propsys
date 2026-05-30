import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardSkeleton } from './admin-dashboard.ui';

describe('DashboardSkeleton', () => {
  it('announces loading while reserving the dashboard layout', () => {
    render(<DashboardSkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando dashboard...');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
