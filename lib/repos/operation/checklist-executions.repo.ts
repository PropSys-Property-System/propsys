import { ChecklistExecution, User } from '@/lib/types';
import { MOCK_CHECKLIST_EXECUTIONS, MOCK_CHECKLIST_TEMPLATES, MOCK_TASKS_V1 } from '@/lib/mocks';
import { canAccessClientRecord, filterItemsByTenant } from '@/lib/auth/access-rules';
import { auditService } from '@/lib/audit/audit-service';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function canReviewChecklist(user: User): boolean {
  return user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'CLIENT_MANAGER' || user.internalRole === 'ROOT_ADMIN';
}

function canCompleteChecklist(params: {
  templateItems: Array<{ id: string; required: boolean }>;
  results: ChecklistExecution['results'];
}): boolean {
  const requiredIds = params.templateItems.filter((it) => it.required).map((it) => it.id);
  if (requiredIds.length === 0) return true;
  const resultByItemId = new Map(params.results.map((r) => [r.itemId, Boolean(r.value)]));
  return requiredIds.every((itemId) => resultByItemId.get(itemId) === true);
}

export const checklistExecutionsRepo = {
  async listForUser(user: User): Promise<ChecklistExecution[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ executions: ChecklistExecution[] }>('/api/v1/operation/checklist-executions', {
        credentials: 'include',
      });
      return data.executions;
    }
    await sleep(200);

    const tenantScoped = filterItemsByTenant(MOCK_CHECKLIST_EXECUTIONS, user).filter((execution) => !execution.deletedAt);

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      if (user.internalRole === 'STAFF') {
        return tenantScoped.filter((x) => buildingIds.includes(x.buildingId) && x.assignedToUserId === user.id);
      }
      return tenantScoped.filter((x) => buildingIds.includes(x.buildingId));
    }

    return [];
  },

  async listForTask(user: User, taskId: string): Promise<ChecklistExecution[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ executions: ChecklistExecution[] }>(
        `/api/v1/operation/checklist-executions?taskId=${encodeURIComponent(taskId)}`,
        { credentials: 'include' }
      );
      return data.executions;
    }
    await sleep(150);
    return (await this.listForUser(user)).filter((x) => x.taskId === taskId);
  },

  async createForTask(user: User, input: { taskId: string; templateId: string }): Promise<ChecklistExecution> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/operation/checklist-executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ taskId: input.taskId, templateId: input.templateId }),
      });
      const data = (await res.json().catch(() => null)) as { execution?: ChecklistExecution; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      if (!data?.execution) throw new Error('Respuesta inválida');
      return data.execution;
    }
    await sleep(200);

    if (user.internalRole !== 'STAFF') throw new Error('No autorizado');
    const task = MOCK_TASKS_V1.find((item) => item.id === input.taskId);
    if (!task) throw new Error('No encontrado');
    if (!canAccessClientRecord(user, task.clientId)) throw new Error('No autorizado');
    if (task.assignedToUserId !== user.id) throw new Error('No autorizado');
    if (!task.checklistTemplateId || task.checklistTemplateId !== input.templateId) {
      throw new Error('Selecciona un checklist.');
    }

    const template = MOCK_CHECKLIST_TEMPLATES.find((item) => item.id === input.templateId && !item.deletedAt);
    if (!template) throw new Error('No encontrado');
    if (!canAccessClientRecord(user, template.clientId)) throw new Error('No autorizado');
    if (template.buildingId !== task.buildingId) throw new Error('No autorizado');

    const current = MOCK_CHECKLIST_EXECUTIONS.find(
      (item) =>
        !item.deletedAt &&
        item.taskId === input.taskId &&
        item.templateId === input.templateId &&
        item.assignedToUserId === user.id &&
        item.status !== 'APPROVED'
    );
    if (current) return { ...current };

    const now = new Date().toISOString();
    const created: ChecklistExecution = {
      id: `chkexec_${Date.now()}`,
      clientId: task.clientId,
      buildingId: task.buildingId,
      taskId: task.id,
      templateId: template.id,
      assignedToUserId: user.id,
      status: 'PENDING',
      results: [],
      createdAt: now,
      updatedAt: now,
    };
    MOCK_CHECKLIST_EXECUTIONS.unshift(created);

    auditService.logAction({
      userId: user.id,
      clientId: created.clientId,
      action: 'CREATE',
      entity: 'ChecklistExecution',
      entityId: created.id,
      newData: created,
      metadata: { buildingId: created.buildingId, templateId: created.templateId, taskId: created.taskId ?? null },
    });

    return { ...created };
  },

  async saveResultsForUser(user: User, id: string, results: ChecklistExecution['results']): Promise<ChecklistExecution | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/checklist-executions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'SAVE', results }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { execution?: ChecklistExecution | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.execution ?? null;
    }
    await sleep(150);
    const idx = MOCK_CHECKLIST_EXECUTIONS.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    const current = MOCK_CHECKLIST_EXECUTIONS[idx];
    if (current.deletedAt) return null;
    if (!canAccessClientRecord(user, current.clientId)) return null;
    if (user.internalRole !== 'STAFF') throw new Error('No autorizado');
    if (current.assignedToUserId !== user.id) throw new Error('No autorizado');
    if (current.status === 'APPROVED') throw new Error('No puedes guardar un checklist aprobado.');

    const now = new Date().toISOString();
    const updated: ChecklistExecution = {
      ...current,
      results,
      updatedAt: now,
    };
    MOCK_CHECKLIST_EXECUTIONS[idx] = updated;

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'ChecklistExecution',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, templateId: updated.templateId, taskId: updated.taskId ?? null, action: 'SAVE' },
    });

    return { ...updated };
  },

  async completeForUser(user: User, id: string, results: ChecklistExecution['results']): Promise<ChecklistExecution | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/checklist-executions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'COMPLETE', results }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { execution?: ChecklistExecution | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.execution ?? null;
    }
    await sleep(200);
    const idx = MOCK_CHECKLIST_EXECUTIONS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_CHECKLIST_EXECUTIONS[idx];
    if (!canAccessClientRecord(user, current.clientId)) return null;
    if (current.deletedAt) return null;
    if (user.internalRole !== 'STAFF') throw new Error('No autorizado');
    if (current.assignedToUserId !== user.id) throw new Error('No autorizado');
    if (current.status === 'APPROVED') throw new Error('No puedes modificar un checklist aprobado.');

    const template = MOCK_CHECKLIST_TEMPLATES.find((t) => t.id === current.templateId);
    if (!canCompleteChecklist({ templateItems: template?.items ?? [], results })) {
      throw new Error('Marca todos los items requeridos para completar el checklist.');
    }

    const now = new Date().toISOString();
    const updated: ChecklistExecution = {
      ...current,
      status: 'COMPLETED',
      results,
      completedAt: now,
      lastReviewAction: undefined,
      reviewComment: undefined,
      reviewedAt: undefined,
      reviewedByUserId: undefined,
      updatedAt: now,
    };

    MOCK_CHECKLIST_EXECUTIONS[idx] = updated;
    if (updated.taskId) {
      const taskIdx = MOCK_TASKS_V1.findIndex((t) => t.id === updated.taskId);
      if (taskIdx !== -1 && MOCK_TASKS_V1[taskIdx].checklistTemplateId) {
        MOCK_TASKS_V1[taskIdx] = { ...MOCK_TASKS_V1[taskIdx], status: 'COMPLETED', updatedAt: now };
      }
    }

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'ChecklistExecution',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, templateId: updated.templateId },
    });

    return updated;
  },

  async approveForUser(user: User, id: string): Promise<ChecklistExecution | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/checklist-executions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { execution?: ChecklistExecution | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.execution ?? null;
    }
    await sleep(200);
    const idx = MOCK_CHECKLIST_EXECUTIONS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_CHECKLIST_EXECUTIONS[idx];
    if (!canAccessClientRecord(user, current.clientId)) return null;
    if (current.deletedAt) return null;
    if (!canReviewChecklist(user)) {
      throw new Error('No autorizado');
    }
    if (current.status !== 'COMPLETED') throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: ChecklistExecution = {
      ...current,
      status: 'APPROVED',
      approvedAt: now,
      lastReviewAction: 'APPROVE',
      reviewComment: undefined,
      reviewedAt: now,
      reviewedByUserId: user.id,
      updatedAt: now,
    };

    MOCK_CHECKLIST_EXECUTIONS[idx] = updated;
    if (updated.taskId) {
      const taskIdx = MOCK_TASKS_V1.findIndex((t) => t.id === updated.taskId);
      if (taskIdx !== -1 && MOCK_TASKS_V1[taskIdx].checklistTemplateId) {
        MOCK_TASKS_V1[taskIdx] = { ...MOCK_TASKS_V1[taskIdx], status: 'APPROVED', updatedAt: now };
      }
    }

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'APPROVE',
      entity: 'ChecklistExecution',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, templateId: updated.templateId },
    });

    return updated;
  },

  async returnForUser(user: User, id: string, input?: { comment?: string }): Promise<ChecklistExecution | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/checklist-executions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'RETURN', comment: input?.comment }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { execution?: ChecklistExecution | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.execution ?? null;
    }

    await sleep(200);
    const idx = MOCK_CHECKLIST_EXECUTIONS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_CHECKLIST_EXECUTIONS[idx];
    if (!canAccessClientRecord(user, current.clientId)) return null;
    if (current.deletedAt) return null;
    if (!canReviewChecklist(user)) {
      throw new Error('No autorizado');
    }
    if (current.status !== 'COMPLETED' && current.status !== 'APPROVED') {
      throw new Error('Solo se puede devolver un checklist completado o aprobado.');
    }

    const now = new Date().toISOString();
    const updated: ChecklistExecution = {
      ...current,
      status: 'PENDING',
      completedAt: undefined,
      approvedAt: undefined,
      lastReviewAction: 'RETURN',
      reviewComment: input?.comment?.trim() || undefined,
      reviewedAt: now,
      reviewedByUserId: user.id,
      updatedAt: now,
    };

    MOCK_CHECKLIST_EXECUTIONS[idx] = updated;
    if (updated.taskId) {
      const taskIdx = MOCK_TASKS_V1.findIndex((t) => t.id === updated.taskId);
      if (taskIdx !== -1 && MOCK_TASKS_V1[taskIdx].checklistTemplateId) {
        MOCK_TASKS_V1[taskIdx] = { ...MOCK_TASKS_V1[taskIdx], status: 'IN_PROGRESS', updatedAt: now };
      }
    }

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'RETURN',
      entity: 'ChecklistExecution',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, templateId: updated.templateId },
    });

    return updated;
  },
};
