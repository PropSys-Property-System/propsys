import { describe, expect, it } from 'vitest';
import { checklistTemplatesRepo } from '@/lib/repos/operation/checklist-templates.repo';
import { MOCK_CHECKLIST_EXECUTIONS, MOCK_CHECKLIST_TEMPLATES, MOCK_TASKS_V1 } from '@/lib/mocks';
import type { User } from '@/lib/types';

function userBase(overrides: Partial<User>): User {
  return {
    id: 'u_test',
    email: 'test@propsys.local',
    name: 'Test',
    role: 'BUILDING_ADMIN',
    internalRole: 'BUILDING_ADMIN',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('checklistTemplatesRepo', () => {
  it('creates a checklist template with items in mock mode', async () => {
    const before = MOCK_CHECKLIST_TEMPLATES.length;
    const admin = userBase({ id: 'u2' });

    const created = await checklistTemplatesRepo.createForUser(admin, {
      buildingId: 'b1',
      name: 'Checklist QA',
      items: [
        { label: 'Revisar acceso', required: true },
        { label: 'Registrar novedades', required: false },
      ],
    });

    expect(created.id).toBeTypeOf('string');
    expect(created.buildingId).toBe('b1');
    expect(created.name).toBe('Checklist QA');
    expect(created.items.length).toBe(2);
    expect(created.items[0]?.id).toBeTypeOf('string');
    expect(created.items[0]?.label).toBe('Revisar acceso');
    expect(created.items[0]?.required).toBe(true);

    expect(MOCK_CHECKLIST_TEMPLATES.length).toBe(before + 1);
    MOCK_CHECKLIST_TEMPLATES.shift();
  });

  it('updates and deletes a checklist template when it is not in use (mock mode)', async () => {
    const admin = userBase({ id: 'u2' });

    const created = await checklistTemplatesRepo.createForUser(admin, {
      buildingId: 'b1',
      name: 'Checklist temporal',
      items: [{ label: 'Item A', required: true }],
    });

    const updated = await checklistTemplatesRepo.updateForUser(admin, created.id, {
      name: 'Checklist actualizado',
      items: [
        { label: 'Item A', required: true },
        { label: 'Item B', required: false },
      ],
    });

    expect(updated?.id).toBe(created.id);
    expect(updated?.name).toBe('Checklist actualizado');
    expect(updated?.items.length).toBe(2);

    const ok = await checklistTemplatesRepo.deleteForUser(admin, created.id);
    expect(ok).toBe(true);
  });

  it('blocks delete when template has active use (mock mode)', async () => {
    const admin = userBase({ id: 'u2' });

    const created = await checklistTemplatesRepo.createForUser(admin, {
      buildingId: 'b1',
      name: 'Checklist en uso',
      items: [{ label: 'Item', required: true }],
    });

    const task = {
      id: `task_test_${Date.now()}`,
      clientId: 'client_001',
      buildingId: 'b1',
      checklistTemplateId: created.id,
      title: 'Tarea',
      status: 'PENDING',
      assignedToUserId: 'u3',
      createdByUserId: 'u2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as const;
    MOCK_TASKS_V1.unshift(task);

    await expect(checklistTemplatesRepo.deleteForUser(admin, created.id)).rejects.toThrow(
      'No se puede eliminar un checklist con tareas o ejecuciones activas.'
    );

    MOCK_TASKS_V1.shift();
    const tplIdx = MOCK_CHECKLIST_TEMPLATES.findIndex((t) => t.id === created.id);
    if (tplIdx !== -1) MOCK_CHECKLIST_TEMPLATES.splice(tplIdx, 1);
    const execIdx = MOCK_CHECKLIST_EXECUTIONS.findIndex((x) => x.templateId === created.id);
    if (execIdx !== -1) MOCK_CHECKLIST_EXECUTIONS.splice(execIdx, 1);
  });

  it('allows versioned edit and soft delete when usage is only historical (mock mode)', async () => {
    const admin = userBase({ id: 'u2' });

    const created = await checklistTemplatesRepo.createForUser(admin, {
      buildingId: 'b1',
      name: 'Checklist historico',
      items: [{ label: 'Item historico', required: true }],
    });

    MOCK_TASKS_V1.unshift({
      id: `task_hist_${Date.now()}`,
      clientId: 'client_001',
      buildingId: 'b1',
      checklistTemplateId: created.id,
      title: 'Tarea aprobada',
      status: 'APPROVED',
      assignedToUserId: 'u3',
      createdByUserId: 'u2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as const);

    const updated = await checklistTemplatesRepo.updateForUser(admin, created.id, {
      name: 'Checklist historico v2',
      items: [{ label: 'Item nuevo', required: true }],
    });

    expect(updated).not.toBeNull();
    expect(updated?.id).not.toBe(created.id);
    expect(updated?.name).toBe('Checklist historico v2');

    const deleted = await checklistTemplatesRepo.deleteForUser(admin, created.id);
    expect(deleted).toBe(true);

    const original = MOCK_CHECKLIST_TEMPLATES.find((t) => t.id === created.id);
    expect(original?.deletedAt).toBeTruthy();

    MOCK_TASKS_V1.shift();
    const originalIdx = MOCK_CHECKLIST_TEMPLATES.findIndex((t) => t.id === created.id);
    if (originalIdx !== -1) MOCK_CHECKLIST_TEMPLATES.splice(originalIdx, 1);
    const updatedIdx = MOCK_CHECKLIST_TEMPLATES.findIndex((t) => t.id === updated?.id);
    if (updatedIdx !== -1) MOCK_CHECKLIST_TEMPLATES.splice(updatedIdx, 1);
  });
});
