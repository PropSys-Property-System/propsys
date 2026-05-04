import { describe, expect, it } from 'vitest';
import { checklistExecutionsRepo } from '@/lib/repos/operation/checklist-executions.repo';
import { MOCK_CHECKLIST_EXECUTIONS, MOCK_CHECKLIST_TEMPLATES, MOCK_TASKS_V1 } from '@/lib/mocks';
import type { ChecklistExecution, User } from '@/lib/types';

function userBase(overrides: Partial<User>): User {
  return {
    id: 'u3',
    email: 'staff@propsys.local',
    name: 'Staff',
    role: 'STAFF',
    internalRole: 'STAFF',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('checklistExecutionsRepo', () => {
  it('creates execution for assigned staff task in mock mode', async () => {
    const staff = userBase({});
    const templateId = `tpl_${Date.now()}`;
    const taskId = `task_${Date.now()}`;
    const now = new Date().toISOString();

    MOCK_CHECKLIST_TEMPLATES.unshift({
      id: templateId,
      clientId: 'client_001',
      buildingId: 'b1',
      name: 'Checklist test',
      items: [{ id: 'i1', label: 'Item 1', required: true }],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    MOCK_TASKS_V1.unshift({
      id: taskId,
      clientId: 'client_001',
      buildingId: 'b1',
      checklistTemplateId: templateId,
      title: 'Task test',
      status: 'IN_PROGRESS',
      assignedToUserId: staff.id,
      createdByUserId: 'u2',
      createdAt: now,
      updatedAt: now,
    });

    const created = await checklistExecutionsRepo.createForTask(staff, { taskId, templateId });
    expect(created.taskId).toBe(taskId);
    expect(created.templateId).toBe(templateId);
    expect(created.status).toBe('PENDING');

    const idxTask = MOCK_TASKS_V1.findIndex((item) => item.id === taskId);
    if (idxTask !== -1) MOCK_TASKS_V1.splice(idxTask, 1);
    const idxTpl = MOCK_CHECKLIST_TEMPLATES.findIndex((item) => item.id === templateId);
    if (idxTpl !== -1) MOCK_CHECKLIST_TEMPLATES.splice(idxTpl, 1);
    const idxExec = MOCK_CHECKLIST_EXECUTIONS.findIndex((item) => item.id === created.id);
    if (idxExec !== -1) MOCK_CHECKLIST_EXECUTIONS.splice(idxExec, 1);
  });

  it('saves and completes execution, preserving return feedback on save and clearing it on complete', async () => {
    const staff = userBase({});
    const templateId = `tpl_${Date.now()}`;
    const executionId = `exec_${Date.now()}`;
    const reviewedAt = new Date().toISOString();
    const now = new Date().toISOString();

    MOCK_CHECKLIST_TEMPLATES.unshift({
      id: templateId,
      clientId: 'client_001',
      buildingId: 'b1',
      name: 'Checklist test',
      items: [{ id: 'req', label: 'Item requerido', required: true }],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    MOCK_CHECKLIST_EXECUTIONS.unshift({
      id: executionId,
      clientId: 'client_001',
      buildingId: 'b1',
      taskId: undefined,
      templateId,
      assignedToUserId: staff.id,
      status: 'PENDING',
      results: [],
      lastReviewAction: 'RETURN',
      reviewComment: 'Corrige evidencia',
      reviewedAt,
      reviewedByUserId: 'u2',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    const saved = await checklistExecutionsRepo.saveResultsForUser(staff, executionId, [{ itemId: 'req', value: true }]);
    expect(saved?.lastReviewAction).toBe('RETURN');
    expect(saved?.reviewComment).toBe('Corrige evidencia');

    const completed = await checklistExecutionsRepo.completeForUser(staff, executionId, [{ itemId: 'req', value: true }]);
    expect(completed?.status).toBe('COMPLETED');
    expect(completed?.lastReviewAction).toBeUndefined();
    expect(completed?.reviewComment).toBeUndefined();

    const idxTpl = MOCK_CHECKLIST_TEMPLATES.findIndex((item) => item.id === templateId);
    if (idxTpl !== -1) MOCK_CHECKLIST_TEMPLATES.splice(idxTpl, 1);
    const idxExec = MOCK_CHECKLIST_EXECUTIONS.findIndex((item) => item.id === executionId);
    if (idxExec !== -1) MOCK_CHECKLIST_EXECUTIONS.splice(idxExec, 1);
  });

  it('requires COMPLETED status to approve execution in mock mode', async () => {
    const admin = userBase({
      id: 'u2',
      role: 'BUILDING_ADMIN',
      internalRole: 'BUILDING_ADMIN',
    });
    const executionId = `exec_${Date.now()}`;
    const now = new Date().toISOString();

    MOCK_CHECKLIST_EXECUTIONS.unshift({
      id: executionId,
      clientId: 'client_001',
      buildingId: 'b1',
      templateId: 'chk-tpl-1',
      assignedToUserId: 'u3',
      status: 'PENDING',
      results: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    } as ChecklistExecution);

    await expect(checklistExecutionsRepo.approveForUser(admin, executionId)).rejects.toThrow('No autorizado');

    const idxExec = MOCK_CHECKLIST_EXECUTIONS.findIndex((item) => item.id === executionId);
    if (idxExec !== -1) MOCK_CHECKLIST_EXECUTIONS.splice(idxExec, 1);
  });
});
