import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboard',
  useRouter: () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockUserBase = {
  id: 'u1',
  email: 'test@propsys.com',
  name: 'Test User',
  scope: 'global',
  status: 'ACTIVE',
};

let mockUser: Record<string, unknown> | null = null;

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
  }),
}));

describe('AppShell', () => {
  beforeEach(() => {
    mockUser = null;
    vi.clearAllMocks();
  });

  it('renders Clientes link for ROOT_ADMIN', () => {
    mockUser = { ...mockUserBase, role: 'MANAGER', internalRole: 'ROOT_ADMIN' };
    render(<AppShell>Content</AppShell>);

    expect(screen.getByRole('link', { name: /Clientes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invitaciones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute('title', 'Abrir menú');
  });

  it('hides Clientes link for CLIENT_MANAGER but shows Invitaciones', () => {
    mockUser = { ...mockUserBase, role: 'MANAGER', internalRole: 'CLIENT_MANAGER' };
    render(<AppShell>Content</AppShell>);

    expect(screen.queryByRole('link', { name: /Clientes/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Invitaciones/i })).toBeInTheDocument();
  });

  it('renders normally when badgesByHref is empty', () => {
    mockUser = { ...mockUserBase, role: 'STAFF', internalRole: 'STAFF' };
    render(<AppShell badgesByHref={{}}>Content</AppShell>);

    expect(screen.getByRole('link', { name: 'Mis tareas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Incidencias' })).toBeInTheDocument();
  });

  it('renders badge in the matching nav item and enriches aria-label', () => {
    mockUser = { ...mockUserBase, role: 'STAFF', internalRole: 'STAFF' };
    render(<AppShell badgesByHref={{ '/staff/tasks': 3 }}>Content</AppShell>);

    const tasksLink = screen.getByRole('link', { name: 'Mis tareas, 3 pendientes' });
    expect(tasksLink).toBeInTheDocument();
    expect(within(tasksLink).getByText('3')).toBeInTheDocument();
  });

  it('does not render badge when href is not present in badgesByHref', () => {
    mockUser = { ...mockUserBase, role: 'STAFF', internalRole: 'STAFF' };
    render(<AppShell badgesByHref={{ '/staff/tasks': 2 }}>Content</AppShell>);

    const incidentsLink = screen.getByRole('link', { name: 'Incidencias' });
    expect(within(incidentsLink).queryByText('2')).not.toBeInTheDocument();
  });

  it('renders `99+` when badge count exceeds 99', () => {
    mockUser = { ...mockUserBase, role: 'STAFF', internalRole: 'STAFF' };
    render(<AppShell badgesByHref={{ '/staff/tasks': 120 }}>Content</AppShell>);

    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis tareas, 99 o más pendientes' })).toBeInTheDocument();
  });

  it('resident does not see admin badges because admin items are not rendered', () => {
    mockUser = { ...mockUserBase, role: 'TENANT', internalRole: 'OCCUPANT' };
    render(
      <AppShell badgesByHref={{ '/admin/receipts': 4, '/resident/receipts': 2 }}>
        Content
      </AppShell>
    );

    expect(screen.queryByRole('link', { name: 'Recibos, 4 pendientes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis recibos, 2 pendientes' })).toBeInTheDocument();
  });

  it('staff does not see admin badges because admin items are not rendered', () => {
    mockUser = { ...mockUserBase, role: 'STAFF', internalRole: 'STAFF' };
    render(
      <AppShell badgesByHref={{ '/admin/tickets': 5, '/staff/tasks': 1 }}>
        Content
      </AppShell>
    );

    expect(screen.queryByRole('link', { name: 'Incidencias, 5 pendientes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis tareas, 1 pendientes' })).toBeInTheDocument();
  });

  it('admin renders badge on Incidencias when /admin/tickets is present', () => {
    mockUser = { ...mockUserBase, role: 'MANAGER', internalRole: 'CLIENT_MANAGER' };
    render(<AppShell badgesByHref={{ '/admin/tickets': 2 }}>Content</AppShell>);

    const incidentsLink = screen.getByRole('link', { name: 'Incidencias, 2 pendientes' });
    expect(incidentsLink).toBeInTheDocument();
    expect(within(incidentsLink).getByText('2')).toBeInTheDocument();
  });

  it('mobile drawer contains badges too', () => {
    mockUser = { ...mockUserBase, role: 'STAFF', internalRole: 'STAFF' };
    render(<AppShell badgesByHref={{ '/staff/tickets': 2 }}>Content</AppShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    expect(screen.getByRole('link', { name: 'Incidencias, 2 pendientes' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
