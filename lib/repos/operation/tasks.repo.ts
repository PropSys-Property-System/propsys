import { TaskEntity, User } from '@/lib/types';
import { MOCK_TASKS_V1 } from '@/lib/mocks';
import { auditService } from '@/lib/audit/audit-service';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const tasksRepo = {
  async listForUser(user: User): Promise<TaskEntity[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ tasks: TaskEntity[] }>('/api/v1/operation/tasks', { credentials: 'include' });
      return data.tasks;
    }
    await sleep(250);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_TASKS_V1
        : user.clientId
          ? MOCK_TASKS_V1.filter((t) => t.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      if (user.internalRole === 'STAFF') return tenantScoped.filter((t) => buildingIds.includes(t.buildingId) && t.assignedToUserId === user.id);
      return tenantScoped.filter((t) => buildingIds.includes(t.buildingId));
    }

    return [];
  },

  async updateStatusForUser(user: User, id: string, status: TaskEntity['status']): Promise<TaskEntity | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { task?: TaskEntity | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.task ?? null;
    }
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
      metadata: { buildingId: updated.buildingId },
    });

    return updated;
  },
};

