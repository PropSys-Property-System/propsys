import { TaskEntity, User } from '@/lib/types';
import { MOCK_CHECKLIST_TEMPLATES, MOCK_TASKS_V1 } from '@/lib/mocks';
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

  async createForUser(
    user: User,
    input: {
      buildingId: string;
      assignedToUserId: string;
      checklistTemplateId?: string;
      title: string;
      description?: string;
      manualChecklistName?: string;
      manualChecklistItems?: Array<{ label: string; required: boolean; order: number }>;
    }
  ): Promise<TaskEntity> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/operation/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { task?: TaskEntity; error?: string } | null;
      if (!res.ok || !data?.task) throw new Error(data?.error || 'No autorizado');
      return data.task;
    }
    await sleep(200);

    if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      throw new Error('No autorizado');
    }
    if (user.scope !== 'platform' && !user.clientId) throw new Error('No autorizado');
    if (!input.buildingId || !input.assignedToUserId || !input.title.trim()) throw new Error('Datos inválidos');
    if (input.manualChecklistItems && input.checklistTemplateId) throw new Error('Datos inválidos');

    const now = new Date().toISOString();
    const checklistTemplateId = input.checklistTemplateId;
    const task: TaskEntity = {
      id: `task_${Date.now()}`,
      clientId: user.scope === 'platform' ? (user.clientId ?? 'client_001') : user.clientId!,
      buildingId: input.buildingId,
      checklistTemplateId,
      assignedToUserId: input.assignedToUserId,
      createdByUserId: user.id,
      title: input.title.trim(),
      description: input.description?.trim() ? input.description.trim() : undefined,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    if (input.manualChecklistItems && input.manualChecklistItems.length > 0) {
      const templateId = `chk_tpl_${Date.now()}`;
      const templateName = input.manualChecklistName?.trim() || 'Checklist manual';
      MOCK_CHECKLIST_TEMPLATES.unshift({
        id: templateId,
        clientId: task.clientId,
        buildingId: task.buildingId,
        isPrivate: true,
        taskId: task.id,
        name: templateName,
        items: input.manualChecklistItems
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((it, idx) => ({
            id: `chk_i_${Date.now()}_${idx + 1}`,
            label: it.label.trim(),
            required: it.required,
          })),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      task.checklistTemplateId = templateId;
    }

    MOCK_TASKS_V1.unshift(task);

    auditService.logAction({
      userId: user.id,
      clientId: task.clientId,
      action: 'CREATE',
      entity: 'Task',
      entityId: task.id,
      newData: task,
      metadata: { buildingId: task.buildingId, assignedToUserId: task.assignedToUserId },
    });

    return task;
  },

  async updateForUser(
    user: User,
    id: string,
    input: Partial<Pick<TaskEntity, 'status' | 'assignedToUserId'>>
  ): Promise<TaskEntity | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
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
      if (input.assignedToUserId) throw new Error('El personal no puede reasignar tareas.');
      if (current.assignedToUserId !== user.id) throw new Error('No autorizado');
      if (input.status === 'APPROVED') throw new Error('El personal no puede aprobar tareas.');
      if (!input.status) throw new Error('Datos inválidos');
      if (current.checklistTemplateId && input.status === 'COMPLETED') {
        throw new Error('La tarea se marca como completada al completar el checklist.');
      }
      if (current.status === 'APPROVED' || current.status === 'COMPLETED') {
        throw new Error('No puedes modificar una tarea completada o aprobada.');
      }
      const isNoOp = current.status === input.status;
      const isAllowedTransition =
        current.checklistTemplateId
          ? current.status === 'PENDING' && input.status === 'IN_PROGRESS'
          : (current.status === 'PENDING' && input.status === 'IN_PROGRESS') ||
            (current.status === 'IN_PROGRESS' && input.status === 'COMPLETED');
      if (!isNoOp && !isAllowedTransition) {
        throw new Error(
          current.checklistTemplateId
            ? 'Transición inválida. En tareas con checklist, el personal solo puede pasar de Pendiente a En progreso.'
            : 'Transición inválida. El personal solo puede pasar de Pendiente a En progreso y de En progreso a Completada.'
        );
      }
    } else {
      if (current.checklistTemplateId && input.status && input.status !== current.status) {
        throw new Error('Esta tarea se gestiona por el checklist y no permite cambios manuales de estado.');
      }
      if (current.status === 'APPROVED') throw new Error('No se puede modificar una tarea aprobada.');
      if (input.status === 'APPROVED' && current.status !== 'COMPLETED') {
        throw new Error('Solo se pueden aprobar tareas que estén Completadas.');
      }
    }
    if (user.internalRole === 'OCCUPANT' || user.internalRole === 'OWNER') throw new Error('No autorizado');

    const now = new Date().toISOString();
    const updated: TaskEntity = {
      ...current,
      assignedToUserId: input.assignedToUserId ?? current.assignedToUserId,
      status: input.status ?? current.status,
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
      metadata: { buildingId: updated.buildingId, assignedToUserId: updated.assignedToUserId },
    });

    return updated;
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
      if (status === 'APPROVED') throw new Error('El personal no puede aprobar tareas.');
      if (current.checklistTemplateId && status === 'COMPLETED') {
        throw new Error('La tarea se marca como completada al completar el checklist.');
      }
      if (current.status === 'APPROVED' || current.status === 'COMPLETED') {
        throw new Error('No puedes modificar una tarea completada o aprobada.');
      }
      const isNoOp = current.status === status;
      const isAllowedTransition =
        current.checklistTemplateId
          ? current.status === 'PENDING' && status === 'IN_PROGRESS'
          : (current.status === 'PENDING' && status === 'IN_PROGRESS') || (current.status === 'IN_PROGRESS' && status === 'COMPLETED');
      if (!isNoOp && !isAllowedTransition) {
        throw new Error(
          current.checklistTemplateId
            ? 'Transición inválida. En tareas con checklist, el personal solo puede pasar de Pendiente a En progreso.'
            : 'Transición inválida. El personal solo puede pasar de Pendiente a En progreso y de En progreso a Completada.'
        );
      }
    }
    if (user.internalRole === 'OCCUPANT' || user.internalRole === 'OWNER') throw new Error('No autorizado');
    if (user.internalRole !== 'STAFF') {
      if (current.checklistTemplateId && status !== current.status) {
        throw new Error('Esta tarea se gestiona por el checklist y no permite cambios manuales de estado.');
      }
      if (current.status === 'APPROVED') throw new Error('No se puede modificar una tarea aprobada.');
      if (status === 'APPROVED' && current.status !== 'COMPLETED') {
        throw new Error('Solo se pueden aprobar tareas que estén Completadas.');
      }
    }

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
