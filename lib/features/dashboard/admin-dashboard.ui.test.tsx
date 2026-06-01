import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DashboardChecklistPanel,
  DashboardQuickLinks,
  DashboardRecentActivityPanel,
  DashboardSkeleton,
  DashboardStatsPanel,
} from './admin-dashboard.ui';

describe('DashboardSkeleton', () => {
  it('announces loading while reserving the dashboard layout', () => {
    render(<DashboardSkeleton />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando dashboard...');
    expect(status.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('uses responsive stats height and reserves four quick links', () => {
    render(<DashboardSkeleton />);

    const status = screen.getByRole('status');
    const responsiveStatsPanel = Array.from(status.querySelectorAll('div')).find((element) =>
      element.classList.contains('lg:h-[400px]'),
    );
    const quickLinksGrid = Array.from(status.querySelectorAll('div')).find((element) =>
      element.classList.contains('xl:grid-cols-4'),
    );

    expect(responsiveStatsPanel).not.toHaveClass('h-[400px]');
    expect(quickLinksGrid?.children).toHaveLength(4);
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

  it('keeps all operational quick links including reservations', () => {
    render(<DashboardQuickLinks user={null} />);

    expect(screen.getByRole('link', { name: /ver recibos/i })).toHaveAttribute('href', '/admin/receipts');
    expect(screen.getByRole('link', { name: /reservas/i })).toHaveAttribute('href', '/admin/reservations');
    expect(screen.getByRole('link', { name: /incidencias/i })).toHaveAttribute('href', '/admin/tickets');
    expect(screen.getByRole('link', { name: /avisos/i })).toHaveAttribute('href', '/admin/notices');
  });

  it('uses fixed stats height only on desktop', () => {
    const { container } = render(
      <DashboardStatsPanel receiptStatusCounts={{ pending: 1, overdue: 2, paid: 3, cancelled: 4 }} />,
    );

    expect(container.firstChild).toHaveClass('h-auto', 'lg:h-[400px]');
    expect(container.firstChild).not.toHaveClass('h-[400px]');
  });

  it('keeps the key analytical and activity sections visible', () => {
    render(
      <>
        <DashboardStatsPanel receiptStatusCounts={{ pending: 1, overdue: 2, paid: 3, cancelled: 4 }} />
        <DashboardRecentActivityPanel recentActivity={[]} agendaReservations={[]} />
      </>,
    );

    expect(screen.getByRole('heading', { name: /distribución de recibos/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /actividad reciente/i })).toBeInTheDocument();
    expect(screen.getByText('Agenda')).toBeInTheDocument();
  });

  it('avoids nested scrolling for recent activity on mobile', () => {
    const { container } = render(<DashboardRecentActivityPanel recentActivity={[]} agendaReservations={[]} />);

    const activityList = container.querySelector('.custom-scrollbar');
    expect(activityList).toHaveClass('lg:overflow-y-auto');
    expect(activityList).not.toHaveClass('overflow-y-auto');
  });

  it('hides checklist actions for roles that do not approve them', () => {
    const { container } = render(
      <DashboardChecklistPanel
        user={{
          id: 'u_manager',
          name: 'Manager',
          role: 'MANAGER',
          internalRole: 'CLIENT_MANAGER',
          clientId: 'client_001',
        }}
        checklistError={null}
        checklistsToApprove={[]}
        templateNameById={{}}
        buildingNameById={{}}
        isApprovingChecklistId={null}
        onApproveChecklist={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
