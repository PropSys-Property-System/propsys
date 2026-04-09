import { IncidentEntity, User } from '@/lib/types';
import { MOCK_INCIDENTS, MOCK_UNITS } from '@/lib/mocks';
import { auditService } from '@/lib/audit/audit-service';
import { accessScope } from '@/lib/access/access-scope';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const incidentsRepo = {
  async listForUser(user: User): Promise<IncidentEntity[]> {
    await sleep(350);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_INCIDENTS
        : user.clientId
          ? MOCK_INCIDENTS.filter((i) => i.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      if (user.internalRole === 'STAFF') {
        return tenantScoped.filter(
          (i) => i.buildingId === user.buildingId && (i.assignedToUserId === user.id || i.reportedByUserId === user.id)
        );
      }
      return tenantScoped.filter((i) => i.buildingId === user.buildingId);
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    return tenantScoped.filter((i) => !i.unitId || unitIds.includes(i.unitId));
  },

  async createSimpleForUser(
    user: User,
    input: Pick<IncidentEntity, 'buildingId' | 'unitId' | 'title' | 'description' | 'priority'>
  ): Promise<IncidentEntity> {
    await sleep(250);

    if (user.internalRole === 'OCCUPANT') throw new Error('No autorizado');
    if (user.scope !== 'platform' && !user.clientId) throw new Error('No autorizado');

    if (user.internalRole === 'OWNER') {
      if (!input.unitId) throw new Error('No autorizado');

      if (!assignmentsRepo.isOwnerOfUnit(user, input.unitId)) throw new Error('No autorizado');

      const tenantUnits =
        user.scope === 'platform'
          ? MOCK_UNITS
          : user.clientId
            ? MOCK_UNITS.filter((u) => u.clientId === user.clientId)
            : [];

      const unit = tenantUnits.find((u) => u.id === input.unitId);
      if (!unit) throw new Error('No autorizado');
      if (unit.buildingId !== input.buildingId) throw new Error('No autorizado');
    }

    const now = new Date().toISOString();
    const incident: IncidentEntity = {
      id: `inc_${Date.now()}`,
      clientId: user.scope === 'platform' ? (user.clientId ?? 'client_001') : user.clientId!,
      buildingId: input.buildingId,
      unitId: input.unitId,
      title: input.title,
      description: input.description,
      status: user.internalRole === 'STAFF' || user.internalRole === 'OWNER' ? 'REPORTED' : 'ASSIGNED',
      priority: input.priority,
      reportedByUserId: user.id,
      assignedToUserId: user.internalRole === 'STAFF' ? user.id : undefined,
      createdAt: now,
      updatedAt: now,
    };

    MOCK_INCIDENTS.unshift(incident);

    auditService.logAction({
      userId: user.id,
      clientId: incident.clientId,
      action: 'CREATE',
      entity: 'Incident',
      entityId: incident.id,
      newData: incident,
      metadata: { buildingId: incident.buildingId, unitId: incident.unitId },
    });

    return incident;
  },

  async updateStatusForUser(user: User, id: string, status: IncidentEntity['status']): Promise<IncidentEntity | null> {
    await sleep(250);
    const idx = MOCK_INCIDENTS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_INCIDENTS[idx];
    if (user.scope !== 'platform' && user.clientId !== current.clientId) return null;

    if (user.internalRole === 'STAFF') {
      if (status === 'CLOSED') throw new Error('No autorizado');
      if (current.assignedToUserId && current.assignedToUserId !== user.id) throw new Error('No autorizado');
    }
    if (user.internalRole === 'OCCUPANT' || user.internalRole === 'OWNER') throw new Error('No autorizado');

    const updated: IncidentEntity = { ...current, status, updatedAt: new Date().toISOString() };
    MOCK_INCIDENTS[idx] = updated;

    auditService.logAction({
      userId: user.id,
      clientId: updated.clientId,
      action: 'UPDATE',
      entity: 'Incident',
      entityId: updated.id,
      oldData: current,
      newData: updated,
      metadata: { buildingId: updated.buildingId, unitId: updated.unitId },
    });

    return updated;
  },
};
