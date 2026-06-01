import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminTasksPage from './page';

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
  const task = {
    id: 'task_1',
    clientId: 'client_001',
    buildingId: 'b1',
    title: 'Revisar ascensor',
    description: 'Control operativo',
    status: 'PENDING',
    assignedToUserId: 'staff_1',
    createdByUserId: 'u_manager',
    createdAt: '2026-06-20T10:00:00.000Z',
    updatedAt: '2026-06-20T11:00:00.000Z',
  };

  return {
    managerUser,
    task,
    loadAdminTasksPageData: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.managerUser }),
}));

vi.mock('@/lib/features/tasks/task-center.data', () => ({
  approveAdminChecklist: vi.fn(),
  approveAdminTask: vi.fn(),
  createAdminTask: vi.fn(),
  deleteAdminTaskTemplate: vi.fn(),
  listAdminTasksForUser: vi.fn(),
  loadAdminTaskReviewData: vi.fn(),
  loadAdminTasksPageData: mocks.loadAdminTasksPageData,
  reassignAdminTask: vi.fn(),
  returnAdminChecklist: vi.fn(),
  saveAdminTaskTemplate: vi.fn(),
}));

vi.mock('@/lib/features/tasks/task-review-dialog', () => ({
  TaskReviewDialog: () => null,
}));

describe('admin tasks loading state', () => {
  beforeEach(() => {
    mocks.loadAdminTasksPageData.mockReset().mockResolvedValue({
      tasks: [mocks.task],
      buildings: [{ id: 'b1', name: 'Torre Norte' }],
      staffByBuildingId: { b1: [] },
      templatesByBuildingId: {},
      templatesError: null,
    });
  });

  it('renders an accessible skeleton without provisional template counts or empty states while loading', () => {
    mocks.loadAdminTasksPageData.mockImplementationOnce(() => new Promise(() => undefined));

    render(<AdminTasksPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tareas...');
    expect(screen.queryByText('0 templates')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin tareas')).not.toBeInTheDocument();
  });

  it('renders real task content after loading', async () => {
    render(<AdminTasksPage />);

    expect(await screen.findByText('Revisar ascensor')).toBeInTheDocument();
  });
});
