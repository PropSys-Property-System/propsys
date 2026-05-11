import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminStaffPage from './staff/page';

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

  const building = { id: 'b1', clientId: 'client_001', name: 'Torre Norte', address: 'Av. 1', city: 'Lima' };
  const staff = [{ id: 'u_staff', buildingId: 'b1', name: 'Staff Operativo', role: 'Personal', status: 'ACTIVE' }];

  return {
    managerUser,
    loadAdminStaffPageData: vi.fn(async () => ({ buildings: [building], defaultBuildingId: 'b1' })),
    listStaffForBuilding: vi.fn(async () => staff),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/physical/physical-center.data', () => ({
  loadAdminStaffPageData: mocks.loadAdminStaffPageData,
  listStaffForBuilding: mocks.listStaffForBuilding,
}));

describe('admin staff page invitation flow', () => {
  beforeEach(() => {
    mocks.loadAdminStaffPageData.mockClear();
    mocks.listStaffForBuilding.mockClear();
  });

  it('keeps staff invitations as the only staff onboarding action while preserving the staff list', async () => {
    render(<AdminStaffPage />);

    await waitFor(() => {
      expect(mocks.loadAdminStaffPageData).toHaveBeenCalledWith(mocks.managerUser);
    });
    await waitFor(() => {
      expect(screen.getByText('Staff Operativo')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /invitar staff/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nuevo staff/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/contrasena/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contrasena temporal/i)).not.toBeInTheDocument();
  });
});
