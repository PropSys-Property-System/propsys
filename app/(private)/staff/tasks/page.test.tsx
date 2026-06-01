import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StaffTasksPage from './page';

const mocks = vi.hoisted(() => {
  const staffUser = {
    id: 'staff_1',
    email: 'staff@propsys.com',
    name: 'Staff',
    role: 'STAFF',
    internalRole: 'STAFF',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    buildingId: 'b1',
  };

  const tasks = [
    {
      id: 'task_pending_checklist',
      clientId: 'client_001',
      buildingId: 'b1',
      checklistTemplateId: 'tmpl_1',
      title: 'Revisar ascensor',
      description: 'Control diario',
      status: 'PENDING',
      assignedToUserId: 'staff_1',
      createdByUserId: 'manager_1',
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T11:00:00.000Z',
    },
    {
      id: 'task_completed',
      clientId: 'client_001',
      buildingId: 'b1',
      checklistTemplateId: 'tmpl_2',
      title: 'Revisión de tableros',
      description: 'Checklist enviado',
      status: 'COMPLETED',
      assignedToUserId: 'staff_1',
      createdByUserId: 'manager_1',
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T11:00:00.000Z',
    },
    {
      id: 'task_approved',
      clientId: 'client_001',
      buildingId: 'b1',
      checklistTemplateId: 'tmpl_3',
      title: 'Inspección final',
      description: 'Checklist aprobado',
      status: 'APPROVED',
      assignedToUserId: 'staff_1',
      createdByUserId: 'manager_1',
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T11:00:00.000Z',
    },
    {
      id: 'task_no_checklist',
      clientId: 'client_001',
      buildingId: 'b1',
      title: 'Mover cajas',
      description: 'Sin checklist',
      status: 'IN_PROGRESS',
      assignedToUserId: 'staff_1',
      createdByUserId: 'manager_1',
      createdAt: '2026-06-20T10:00:00.000Z',
      updatedAt: '2026-06-20T11:00:00.000Z',
    },
  ];

  return {
    staffUser,
    tasks,
    loadStaffTasksPageData: vi.fn(),
    listStaffTasksForUser: vi.fn(),
    updateStaffTaskStatus: vi.fn(),
  };
});

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mocks.staffUser }),
}));

vi.mock('@/lib/features/tasks/task-center.data', () => ({
  completeStaffTaskChecklist: vi.fn(),
  createStaffTaskExecution: vi.fn(),
  deleteStaffTaskEvidence: vi.fn(),
  listStaffTasksForUser: mocks.listStaffTasksForUser,
  loadStaffTaskChecklistData: vi.fn(),
  loadStaffTasksPageData: mocks.loadStaffTasksPageData,
  saveStaffTaskChecklist: vi.fn(),
  updateStaffTaskStatus: mocks.updateStaffTaskStatus,
  uploadStaffTaskEvidence: vi.fn(),
}));

vi.mock('@/lib/features/tasks/task-checklist-dialog', () => ({
  TaskChecklistDialog: () => null,
}));

describe('staff tasks page UX polish', () => {
  beforeEach(() => {
    mocks.updateStaffTaskStatus.mockReset().mockResolvedValue({
      ...mocks.tasks[0],
      status: 'IN_PROGRESS',
    });
    mocks.loadStaffTasksPageData.mockReset().mockResolvedValue({
      tasks: mocks.tasks,
      buildingNameById: { b1: 'Torre Norte' },
    });
    mocks.listStaffTasksForUser.mockReset().mockResolvedValue(mocks.tasks);
  });

  it('renders an accessible skeleton without an empty state while loading', () => {
    mocks.loadStaffTasksPageData.mockImplementationOnce(() => new Promise(() => undefined));

    render(<StaffTasksPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando tareas...');
    expect(screen.queryByText('Sin tareas')).not.toBeInTheDocument();
  });

  it('shows contextual checklist CTA and indicators in task cards', async () => {
    render(<StaffTasksPage />);

    const pendingCard = (await screen.findByText('Revisar ascensor')).closest('.bg-white.border.border-slate-200.rounded-2xl');
    const completedCard = screen.getByText('Revisión de tableros').closest('.bg-white.border.border-slate-200.rounded-2xl');
    const approvedCard = screen.getByText('Inspección final').closest('.bg-white.border.border-slate-200.rounded-2xl');
    const noChecklistCard = screen.getByText('Mover cajas').closest('.bg-white.border.border-slate-200.rounded-2xl');

    expect(pendingCard).not.toBeNull();
    expect(completedCard).not.toBeNull();
    expect(approvedCard).not.toBeNull();
    expect(noChecklistCard).not.toBeNull();

    expect(within(pendingCard as HTMLElement).getByText('Checklist pendiente')).toBeInTheDocument();
    expect(within(pendingCard as HTMLElement).getByRole('button', { name: 'Continuar checklist' })).toBeInTheDocument();

    expect(within(completedCard as HTMLElement).getByText('Checklist enviado', { selector: 'span' })).toBeInTheDocument();
    expect(within(completedCard as HTMLElement).getByRole('button', { name: 'Revisar checklist enviado' })).toBeInTheDocument();

    expect(within(approvedCard as HTMLElement).getByText('Checklist aprobado', { selector: 'span' })).toBeInTheDocument();
    expect(within(approvedCard as HTMLElement).getByRole('button', { name: 'Ver checklist aprobado' })).toBeInTheDocument();

    expect(within(noChecklistCard as HTMLElement).getByText('Sin checklist', { selector: 'span' })).toBeInTheDocument();
    expect(within(noChecklistCard as HTMLElement).queryByRole('button', { name: /checklist/i })).not.toBeInTheDocument();
  });

  it('keeps the pending to in-progress action working', async () => {
    render(<StaffTasksPage />);

    const pendingCard = (await screen.findByText('Revisar ascensor')).closest('.bg-white.border.border-slate-200.rounded-2xl');
    expect(pendingCard).not.toBeNull();

    fireEvent.change(within(pendingCard as HTMLElement).getByRole('combobox'), {
      target: { value: 'IN_PROGRESS' },
    });
    fireEvent.click(within(pendingCard as HTMLElement).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(mocks.updateStaffTaskStatus).toHaveBeenCalledWith(mocks.staffUser, {
        taskId: 'task_pending_checklist',
        status: 'IN_PROGRESS',
      });
    });
  });
});
