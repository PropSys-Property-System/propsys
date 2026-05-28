import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersPage from './users/page';

const mocks = vi.hoisted(() => {
  const managerUser = {
    id: 'u_manager',
    email: 'manager@propsys.com',
    name: 'Manager',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
  };

  const buildings = [{ id: 'b1', clientId: 'client_001', name: 'Torre Norte', address: 'Av. 1', city: 'Lima' }];
  const units = [{ id: 'unit_101', clientId: 'client_001', buildingId: 'b1', number: '101' }];
  const clients = [{ id: 'client_001', slug: 'cliente-uno', name: 'Cliente Uno', status: 'ACTIVE' }];

  return {
    managerUser,
    loadAdminUsersPageData: vi.fn(async () => ({
      users: [],
      buildings,
      units,
      clients,
    })),
    createClientForRoot: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/users/users-center.data', () => ({
  createClientForRoot: mocks.createClientForRoot,
  loadAdminUsersPageData: mocks.loadAdminUsersPageData,
  updateAdminUserProfile: vi.fn(),
  updateAdminUserStatus: vi.fn(),
}));

describe('admin users page invitation flow', () => {
  beforeEach(() => {
    mocks.loadAdminUsersPageData.mockClear();
    mocks.createClientForRoot.mockClear();
  });

  it('keeps invitations as the primary user creation action without the legacy direct-create form', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(mocks.loadAdminUsersPageData).toHaveBeenCalledWith(mocks.managerUser);
    });

    expect(screen.getByRole('button', { name: /invitar usuario/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nuevo usuario/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
  });
});
