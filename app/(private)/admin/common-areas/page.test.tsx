import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminCommonAreasPage from './page';

const mocks = vi.hoisted(() => {
  const managerUser = {
    id: 'u_manager',
    email: 'manager@propsys.local',
    name: 'Manager',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
  };
  const building = {
    id: 'building_1',
    clientId: 'client_001',
    name: 'Torre Norte',
    address: 'Av. Principal 123',
    city: 'Lima',
  };

  return {
    managerUser,
    building,
    loadAdminCommonAreasPageData: vi.fn(async () => ({ buildings: [building], defaultBuildingId: building.id })),
    listCommonAreasForBuilding: vi.fn(async () => []),
    listArchivedCommonAreasForBuilding: vi.fn(async () => []),
    archiveCommonAreaForUser: vi.fn(),
    createCommonAreaForUser: vi.fn(),
    restoreCommonAreaForUser: vi.fn(),
    updateCommonAreaForUser: vi.fn(),
    updateCommonAreaApprovalForUser: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/physical/physical-center.data', () => ({
  loadAdminCommonAreasPageData: mocks.loadAdminCommonAreasPageData,
  listCommonAreasForBuilding: mocks.listCommonAreasForBuilding,
  listArchivedCommonAreasForBuilding: mocks.listArchivedCommonAreasForBuilding,
  archiveCommonAreaForUser: mocks.archiveCommonAreaForUser,
  createCommonAreaForUser: mocks.createCommonAreaForUser,
  restoreCommonAreaForUser: mocks.restoreCommonAreaForUser,
  updateCommonAreaForUser: mocks.updateCommonAreaForUser,
  updateCommonAreaApprovalForUser: mocks.updateCommonAreaApprovalForUser,
}));

describe('admin common areas page polish', () => {
  beforeEach(() => {
    mocks.loadAdminCommonAreasPageData.mockReset().mockResolvedValue({
      buildings: [mocks.building],
      defaultBuildingId: mocks.building.id,
    });
    mocks.listCommonAreasForBuilding.mockReset().mockResolvedValue([]);
    mocks.listArchivedCommonAreasForBuilding.mockReset().mockResolvedValue([]);
  });

  it('renders an accessible skeleton without provisional counters or empty states while loading', () => {
    mocks.loadAdminCommonAreasPageData.mockImplementationOnce(() => new Promise(() => undefined));

    render(<AdminCommonAreasPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando áreas comunes...');
    expect(screen.queryByText('Activas (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Archivadas (0)')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin edificio')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin áreas')).not.toBeInTheDocument();
  });

  it('renders real common-area content after loading', async () => {
    mocks.listCommonAreasForBuilding.mockResolvedValueOnce([
      {
        id: 'area_1',
        clientId: 'client_001',
        buildingId: mocks.building.id,
        name: 'Terraza',
        capacity: 20,
        requiresApproval: true,
      },
    ]);

    render(<AdminCommonAreasPage />);

    expect(await screen.findByText('Terraza')).toBeInTheDocument();
  });

  it('exposes accessible labels for the common-area composer fields', async () => {
    render(<AdminCommonAreasPage />);

    const openComposer = await screen.findByRole('button', { name: /nueva área com.n/i });
    await waitFor(() => expect(openComposer).toBeEnabled());
    fireEvent.click(openComposer);

    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Capacidad')).toBeInTheDocument();
  });
});
