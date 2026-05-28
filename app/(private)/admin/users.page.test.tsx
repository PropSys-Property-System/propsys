import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  const mockUsers = [
    { id: 'u1', name: 'Alice Owner', email: 'a@a.com', role: 'RESIDENT', internalRole: 'OWNER', status: 'ACTIVE', buildingId: 'b1', unitId: 'unit_101', clientId: 'client_001' },
    { id: 'u2', name: 'Bob Admin', email: 'b@b.com', role: 'ADMIN', internalRole: 'BUILDING_ADMIN', status: 'ACTIVE', buildingId: 'b1', unitId: null, clientId: 'client_001' },
    { id: 'u3', name: 'Charlie Staff', email: 'c@c.com', role: 'STAFF', internalRole: 'STAFF', status: 'SUSPENDED', buildingId: 'b2', unitId: null, clientId: 'client_001' },
    { id: 'u4', name: 'Dave Occupant', email: 'd@d.com', role: 'RESIDENT', internalRole: 'OCCUPANT', status: 'ACTIVE', buildingId: 'b1', unitId: 'unit_102', clientId: 'client_001' }
  ];

  const buildings = [
    { id: 'b1', clientId: 'client_001', name: 'Torre Norte', address: 'Av. 1', city: 'Lima' },
    { id: 'b2', clientId: 'client_001', name: 'Torre Sur', address: 'Av. 2', city: 'Lima' }
  ];
  const units = [
    { id: 'unit_101', clientId: 'client_001', buildingId: 'b1', number: '101' },
    { id: 'unit_102', clientId: 'client_001', buildingId: 'b1', number: '102' }
  ];
  const clients = [{ id: 'client_001', slug: 'cliente-uno', name: 'Cliente Uno', status: 'ACTIVE' }];

  return {
    managerUser,
    mockUsers,
    loadAdminUsersPageData: vi.fn(async () => ({
      users: mockUsers,
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

describe('admin users page filters', () => {
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

  it('renders filters for role, status, and building', async () => {
    render(<UsersPage />);
    
    await waitFor(() => {
      expect(mocks.loadAdminUsersPageData).toHaveBeenCalledWith(mocks.managerUser);
    });

    expect(screen.getByRole('combobox', { name: /filtrar por rol/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filtrar por estado/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /filtrar por edificio/i })).toBeInTheDocument();
  });

  it('filters users by role', async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice Owner')).toBeInTheDocument());

    const roleSelect = screen.getByRole('combobox', { name: /filtrar por rol/i });
    
    // Select OWNER
    fireEvent.change(roleSelect, { target: { value: 'OWNER' } });
    
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.queryByText('Bob Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Charlie Staff')).not.toBeInTheDocument();
  });

  it('filters users by status', async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice Owner')).toBeInTheDocument());

    const statusSelect = screen.getByRole('combobox', { name: /filtrar por estado/i });
    
    // Select SUSPENDED
    fireEvent.change(statusSelect, { target: { value: 'SUSPENDED' } });
    
    expect(screen.getByText('Charlie Staff')).toBeInTheDocument();
    expect(screen.queryByText('Alice Owner')).not.toBeInTheDocument();
  });

  it('combines text search with role filter', async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice Owner')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/buscar por nombre, email/i);
    const roleSelect = screen.getByRole('combobox', { name: /filtrar por rol/i });

    // Both Dave and Alice are residents, Bob is admin
    fireEvent.change(roleSelect, { target: { value: 'OCCUPANT' } }); // Dave Occupant
    fireEvent.change(searchInput, { target: { value: 'dave' } });

    expect(screen.getByText('Dave Occupant')).toBeInTheDocument();
    expect(screen.queryByText('Alice Owner')).not.toBeInTheDocument();
  });

  it('filters by building and dynamically shows unit filter', async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice Owner')).toBeInTheDocument());

    expect(screen.queryByRole('combobox', { name: /filtrar por unidad/i })).not.toBeInTheDocument();

    const buildingSelect = screen.getByRole('combobox', { name: /filtrar por edificio/i });
    
    // Select Torre Norte (b1)
    fireEvent.change(buildingSelect, { target: { value: 'b1' } });
    
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.getByText('Bob Admin')).toBeInTheDocument();
    expect(screen.getByText('Dave Occupant')).toBeInTheDocument();
    expect(screen.queryByText('Charlie Staff')).not.toBeInTheDocument();

    // Unit filter should now be visible
    const unitSelect = screen.getByRole('combobox', { name: /filtrar por unidad/i });
    expect(unitSelect).toBeInTheDocument();

    // Select unit_101
    fireEvent.change(unitSelect, { target: { value: 'unit_101' } });

    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.queryByText('Dave Occupant')).not.toBeInTheDocument(); // Dave is 102
  });

  it('clears unit filter when building changes', async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice Owner')).toBeInTheDocument());

    const buildingSelect = screen.getByRole('combobox', { name: /filtrar por edificio/i });
    fireEvent.change(buildingSelect, { target: { value: 'b1' } });
    
    const unitSelect = screen.getByRole('combobox', { name: /filtrar por unidad/i });
    fireEvent.change(unitSelect, { target: { value: 'unit_101' } });

    // Change building to b2
    fireEvent.change(buildingSelect, { target: { value: 'b2' } });

    // Unit filter should disappear because we cleared to ALL
    // Wait, the select is visible if building !== 'ALL' and units > 0
    // If building is b2, unit dropdown should show units for b2 (which is empty in our mock for now, 
    // wait, our mock has no units for b2, so unitSelect will disappear).
    expect(screen.queryByRole('combobox', { name: /filtrar por unidad/i })).not.toBeInTheDocument();
    
    // Only Charlie Staff is in b2
    expect(screen.getByText('Charlie Staff')).toBeInTheDocument();
    expect(screen.queryByText('Alice Owner')).not.toBeInTheDocument();
  });
});
