import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminDashboard from './page';

const mocks = vi.hoisted(() => ({
  loadAdminDashboardData: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'u_manager',
      name: 'Manager',
      role: 'MANAGER',
      internalRole: 'CLIENT_MANAGER',
      clientId: 'client_001',
    },
  }),
}));

vi.mock('@/lib/features/dashboard/admin-dashboard.data', () => ({
  loadAdminDashboardData: mocks.loadAdminDashboardData,
  approveAdminDashboardChecklist: vi.fn(),
}));

describe('admin dashboard loading state', () => {
  it('renders the dashboard skeleton while data is loading', () => {
    render(<AdminDashboard />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando dashboard...');
  });
});
