import { TaskEntity, User } from '@/lib/types';
import { MOCK_TASKS_V1 } from '@/lib/mocks';
import { auditService } from '@/lib/audit/audit-service';
import { accessScope } from '@/lib/access/access-scope';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const tasksRepo = {
  async listForUser(user: User): Promise<TaskEntity[]> {
    await sleep(250);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_TASKS_V1
        : user.clientId
          ? MOCK_TASKS_V1.filter((t) => t.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      if (user.internalRole === 'STAFF') return tenantScoped.filter((t) => t.buildingId === user.buildingId && t.assignedToUserId === user.id);
      return tenantScoped.filter((t) => t.buildingId === user.buildingId);
    }

    return [];
  },

  async updateStatusForUser(user: User, id: string, status: TaskEntity['status']): Promise<TaskEntity | null> {
    await sleep(200);
    const idx = MOCK_TASKS_V1.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_TASKS_V1[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;

    if (user.internalRole === 'STAFF') {
      if (current.assignedToUserId !== user.id) throw new Error('No autorizado');
      if (status === 'APPROVED') throw new Error('No autorizado');
    }
    if (user.internalRole === 'OCCUPANT' || user.internalRole === 'OWNER') throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: TaskEntity = {
      ...current,
      status,
      updatedAt: now,
      completedAt: status === 'COMPLETED' ? now : current.completedAt,
      approvedAt: status === 'APPROVED' ? now : current.approvedAt,
    };

    MOCK_TASKS_V1[idx] = updated;

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'Task',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId },
    });

    return updated;
  },
};
