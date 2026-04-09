import { ChecklistExecution, User } from '@/lib/types';
import { MOCK_CHECKLIST_EXECUTIONS } from '@/lib/mocks';
import { auditService } from '@/lib/audit/audit-service';
import { accessScope } from '@/lib/access/access-scope';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checklistExecutionsRepo = {
  async listForUser(user: User): Promise<ChecklistExecution[]> {
    await sleep(200);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_CHECKLIST_EXECUTIONS
        : user.clientId
          ? MOCK_CHECKLIST_EXECUTIONS.filter((x) => x.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      if (user.internalRole === 'STAFF') {
        return tenantScoped.filter((x) => x.buildingId === user.buildingId && x.assignedToUserId === user.id);
      }
      return tenantScoped.filter((x) => x.buildingId === user.buildingId);
    }

    return [];
  },

  async completeForUser(user: User, id: string, results: ChecklistExecution['results']): Promise<ChecklistExecution | null> {
    await sleep(200);
    const idx = MOCK_CHECKLIST_EXECUTIONS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_CHECKLIST_EXECUTIONS[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;
    if (user.internalRole !== 'STAFF') throw new Error('No autorizado');
    if (current.assignedToUserId !== user.id) throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: ChecklistExecution = {
      ...current,
      status: 'COMPLETED',
      results,
      completedAt: now,
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
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId, templateId: updated.templateId },
    });

    return updated;
  },

  async approveForUser(user: User, id: string): Promise<ChecklistExecution | null> {
    await sleep(200);
    const idx = MOCK_CHECKLIST_EXECUTIONS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_CHECKLIST_EXECUTIONS[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;
    if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER') throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: ChecklistExecution = {
      ...current,
      status: 'APPROVED',
      approvedAt: now,
      updatedAt: now,
    };

    MOCK_CHECKLIST_EXECUTIONS[idx] = updated;

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
};
