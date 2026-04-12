import { ChecklistTemplate, User } from '@/lib/types';
import { MOCK_CHECKLIST_EXECUTIONS, MOCK_CHECKLIST_TEMPLATES, MOCK_TASKS_V1 } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checklistTemplatesRepo = {
  async listForUser(user: User): Promise<ChecklistTemplate[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ templates: ChecklistTemplate[] }>('/api/v1/operation/checklist-templates', {
        credentials: 'include',
      });
      return data.templates;
    }
    await sleep(200);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_CHECKLIST_TEMPLATES
        : user.clientId
          ? MOCK_CHECKLIST_TEMPLATES.filter((t) => t.clientId === user.clientId)
          : [];
    const publicOnly = tenantScoped.filter((t) => !t.isPrivate && !t.deletedAt);

    if (accessScope(user) === 'PORTFOLIO') return publicOnly;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      return publicOnly.filter((t) => buildingIds.includes(t.buildingId));
    }

    return [];
  },

  async getByIdForUser(user: User, id: string): Promise<ChecklistTemplate | null> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ template: ChecklistTemplate | null }>(`/api/v1/operation/checklist-templates/${id}`, {
        credentials: 'include',
      });
      return data.template;
    }
    await sleep(150);

    const tpl = MOCK_CHECKLIST_TEMPLATES.find((t) => t.id === id) ?? null;
    if (!tpl) return null;
    if (user.scope !== 'platform' && user.clientId && tpl.clientId !== user.clientId) return null;

    if (!tpl.isPrivate) return tpl;

    if (!tpl.taskId) return null;
    if (user.internalRole === 'STAFF') {
      const task = MOCK_TASKS_V1.find((t) => t.id === tpl.taskId) ?? null;
      if (!task) return null;
      if (task.assignedToUserId !== user.id) return null;
      if (task.checklistTemplateId !== tpl.id) return null;
      return tpl;
    }

    if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'CLIENT_MANAGER' || user.internalRole === 'ROOT_ADMIN') {
      return tpl;
    }

    return null;
  },

  async createForUser(
    user: User,
    input: { buildingId: string; name: string; items: Array<{ label: string; required: boolean }> }
  ): Promise<ChecklistTemplate> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/operation/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { template?: ChecklistTemplate; error?: string } | null;
      if (!res.ok || !data?.template) throw new Error(data?.error || 'No autorizado');
      return data.template;
    }
    await sleep(200);

    if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      throw new Error('No autorizado');
    }
    if (user.scope !== 'platform' && !user.clientId) throw new Error('No autorizado');
    if (!input.buildingId || !input.name.trim() || input.items.length === 0 || input.items.some((it) => !it.label.trim())) {
      throw new Error('Datos inválidos');
    }

    const now = new Date().toISOString();
    const template: ChecklistTemplate = {
      id: `chk_tpl_${Date.now()}`,
      clientId: user.scope === 'platform' ? (user.clientId ?? 'client_001') : user.clientId!,
      buildingId: input.buildingId,
      isPrivate: false,
      name: input.name.trim(),
      items: input.items.map((it, idx) => ({
        id: `chk_i_${Date.now()}_${idx + 1}`,
        label: it.label.trim(),
        required: it.required,
      })),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    MOCK_CHECKLIST_TEMPLATES.unshift(template);
    return template;
  },

  async updateForUser(
    user: User,
    id: string,
    input: { name: string; items: Array<{ label: string; required: boolean }> }
  ): Promise<ChecklistTemplate | null> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/checklist-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { template?: ChecklistTemplate | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.template ?? null;
    }
    await sleep(150);

    if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      throw new Error('No autorizado');
    }
    if (user.scope !== 'platform' && !user.clientId) throw new Error('No autorizado');
    if (!input.name.trim() || input.items.length === 0 || input.items.some((it) => !it.label.trim())) throw new Error('Datos inválidos');

    const idx = MOCK_CHECKLIST_TEMPLATES.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const current = MOCK_CHECKLIST_TEMPLATES[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;
    if (current.isPrivate) throw new Error('No se puede editar un checklist manual por tarea.');

    const hasActiveTaskUse = MOCK_TASKS_V1.some((t) => t.checklistTemplateId === id && t.status !== 'APPROVED');
    const hasActiveExecutionUse = MOCK_CHECKLIST_EXECUTIONS.some((x) => x.templateId === id && !x.deletedAt && x.status !== 'APPROVED');
    if (hasActiveTaskUse || hasActiveExecutionUse) throw new Error('No se puede editar un checklist con tareas o ejecuciones activas.');

    const hasHistoricalUse =
      MOCK_TASKS_V1.some((t) => t.checklistTemplateId === id) ||
      MOCK_CHECKLIST_EXECUTIONS.some((x) => x.templateId === id && !x.deletedAt);

    const now = new Date().toISOString();
    const nextItems = input.items.map((it, index) => ({
      id: `chk_i_${Date.now()}_${index + 1}`,
      label: it.label.trim(),
      required: it.required,
    }));

    if (hasHistoricalUse) {
      MOCK_CHECKLIST_TEMPLATES[idx] = {
        ...current,
        deletedAt: now,
        updatedAt: now,
      };

      const replacement: ChecklistTemplate = {
        id: `chk_tpl_${Date.now()}`,
        clientId: current.clientId,
        buildingId: current.buildingId,
        isPrivate: false,
        name: input.name.trim(),
        items: nextItems,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      MOCK_CHECKLIST_TEMPLATES.unshift(replacement);
      return replacement;
    }

    const updated: ChecklistTemplate = {
      ...current,
      name: input.name.trim(),
      items: nextItems,
      updatedAt: now,
    };
    MOCK_CHECKLIST_TEMPLATES[idx] = updated;
    return updated;
  },

  async deleteForUser(user: User, id: string): Promise<boolean> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/checklist-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return Boolean(data?.ok);
    }
    await sleep(150);

    if (user.internalRole !== 'BUILDING_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'ROOT_ADMIN') {
      throw new Error('No autorizado');
    }
    if (user.scope !== 'platform' && !user.clientId) throw new Error('No autorizado');

    const idx = MOCK_CHECKLIST_TEMPLATES.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    const current = MOCK_CHECKLIST_TEMPLATES[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return false;
    if (current.isPrivate) throw new Error('No se puede eliminar un checklist manual por tarea.');

    const hasActiveTaskUse = MOCK_TASKS_V1.some((t) => t.checklistTemplateId === id && t.status !== 'APPROVED');
    const hasActiveExecutionUse = MOCK_CHECKLIST_EXECUTIONS.some((x) => x.templateId === id && !x.deletedAt && x.status !== 'APPROVED');
    if (hasActiveTaskUse || hasActiveExecutionUse) throw new Error('No se puede eliminar un checklist con tareas o ejecuciones activas.');

    const now = new Date().toISOString();
    MOCK_CHECKLIST_TEMPLATES[idx] = {
      ...current,
      deletedAt: now,
      updatedAt: now,
    };
    return true;
  },
};
