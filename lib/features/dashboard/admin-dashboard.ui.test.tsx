import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardQuickLinks, DashboardRecentActivityPanel, DashboardSkeleton } from './admin-dashboard.ui';

describe('DashboardSkeleton', () => {
  it('announces loading while reserving the dashboard layout', () => {
    render(<DashboardSkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando dashboard...');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe('dashboard polish', () => {
  it('does not render a self-referencing view-all action in recent activity', () => {
    render(<DashboardRecentActivityPanel recentActivity={[]} agendaReservations={[]} />);

    expect(screen.queryByText('Ver Todo')).not.toBeInTheDocument();
  });

  it('keeps the notices quick link with the notices icon', () => {
    render(<DashboardQuickLinks user={null} />);

    const noticesLink = screen.getByRole('link', { name: /avisos/i });
    expect(noticesLink).toHaveAttribute('href', '/admin/notices');
    expect(noticesLink.querySelector('.lucide-megaphone')).toBeInTheDocument();
  });
});
