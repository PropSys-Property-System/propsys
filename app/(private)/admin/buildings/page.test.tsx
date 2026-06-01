import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BuildingsPage from './page';

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
  const building = {
    id: 'b1',
    clientId: 'client_001',
    name: 'Torre Norte',
    address: 'Av. Principal 123',
    city: 'Lima',
  };

  return {
    managerUser,
    building,
    loadAdminBuildingsPageData: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/physical/physical-center.data', () => ({
  archiveBuildingForUser: vi.fn(),
  assignUserToUnit: vi.fn(),
  createBuildingForUser: vi.fn(),
  createUnitForBuilding: vi.fn(),
  listUnitsForBuilding: vi.fn(),
  loadAdminBuildingsPageData: mocks.loadAdminBuildingsPageData,
  restoreBuildingForUser: vi.fn(),
  unassignUnitResident: vi.fn(),
}));

vi.mock('@/lib/features/users/invitations.ui', () => ({
  InvitationCreationDialog: () => null,
}));

describe('admin buildings loading state', () => {
  beforeEach(() => {
    mocks.loadAdminBuildingsPageData.mockReset().mockResolvedValue({
      buildings: [mocks.building],
      archivedBuildings: [],
      clients: [],
    });
  });

  it('renders an accessible skeleton without provisional counters or empty states while loading', () => {
    mocks.loadAdminBuildingsPageData.mockImplementationOnce(() => new Promise(() => undefined));

    render(<BuildingsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando edificios...');
    expect(screen.queryByText('Activos (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Archivados (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin edificios')).not.toBeInTheDocument();
  });

  it('renders real building content after loading', async () => {
    render(<BuildingsPage />);

    expect(await screen.findByText('Torre Norte')).toBeInTheDocument();
  });
});
