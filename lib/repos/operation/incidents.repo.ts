import { IncidentEntity, User } from '@/lib/types';
import { MOCK_INCIDENTS, MOCK_UNITS } from '@/lib/mocks';
import { canAccessClientRecord, filterItemsByTenant, requireClientContext } from '@/lib/auth/access-rules';
import { auditService } from '@/lib/audit/audit-service';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const incidentsRepo = {
  async listForUser(user: User): Promise<IncidentEntity[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ incidents: IncidentEntity[] }>('/api/v1/operation/incidents', { credentials: 'include' });
      return data.incidents;
    }
    await sleep(350);

    const tenantScoped = filterItemsByTenant(MOCK_INCIDENTS, user);

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      if (user.internalRole === 'STAFF') {
        return tenantScoped.filter(
          (i) => buildingIds.includes(i.buildingId) && (i.assignedToUserId === user.id || i.reportedByUserId === user.id)
        );
      }
      return tenantScoped.filter((i) => buildingIds.includes(i.buildingId));
    }

    const units = await unitsRepo.listForUser(user);
    const unitIds = units.map((u) => u.id);
    const buildingIds = Array.from(new Set(units.map((u) => u.buildingId)));
    return tenantScoped.filter((i) => (i.unitId ? unitIds.includes(i.unitId) : buildingIds.includes(i.buildingId)));
  },

  async createSimpleForUser(
    user: User,
    input: Pick<IncidentEntity, 'buildingId' | 'unitId' | 'title' | 'description' | 'priority'>
  ): Promise<IncidentEntity> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/operation/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { incident?: IncidentEntity; error?: string } | null;
      if (!res.ok || !data?.incident) throw new Error(data?.error || 'No autorizado');
      return data.incident;
    }
    await sleep(250);

    if (user.internalRole === 'OCCUPANT') throw new Error('No autorizado');

    const clientId = requireClientContext(user, 'Selecciona un cliente para continuar.');

    if (user.internalRole === 'OWNER') {
      if (!input.unitId) throw new Error('No autorizado');
      if (!assignmentsRepo.isOwnerOfUnit(user, input.unitId)) throw new Error('No autorizado');

      const tenantUnits = filterItemsByTenant(MOCK_UNITS, user);
      const unit = tenantUnits.find((u) => u.id === input.unitId);
      if (!unit) throw new Error('No autorizado');
      if (unit.buildingId !== input.buildingId) throw new Error('No autorizado');
    }

    const now = new Date().toISOString();
    const incident: IncidentEntity = {
      id: `inc_${Date.now()}`,
      clientId,
      buildingId: input.buildingId,
      unitId: input.unitId,
      title: input.title,
      description: input.description,
      status: 'REPORTED',
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
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.status === 404) return null;
      const data = (await res.json().catch(() => null)) as { incident?: IncidentEntity | null; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return data?.incident ?? null;
    }
    await sleep(250);
    const idx = MOCK_INCIDENTS.findIndex((x) => x.id === id);
    if (idx === -1) return null;

    const current = MOCK_INCIDENTS[idx];
    if (!canAccessClientRecord(user, current.clientId)) return null;

    if (user.internalRole === 'STAFF') {
      const canTouchIncident = current.assignedToUserId === user.id || current.reportedByUserId === user.id;
      if (!canTouchIncident) throw new Error('No autorizado');
      if (current.status === 'RESOLVED' || current.status === 'CLOSED') {
        throw new Error('No puedes modificar una incidencia resuelta o cerrada.');
      }
      if (status === 'CLOSED') throw new Error('El personal no puede cerrar incidencias.');
      if (status !== 'IN_PROGRESS' && status !== 'RESOLVED') {
        throw new Error('El personal solo puede marcar incidencias como En progreso o Resueltas.');
      }
    }
    if (user.internalRole === 'OCCUPANT' || user.internalRole === 'OWNER') throw new Error('No autorizado');

    if (status === 'ASSIGNED' && !current.assignedToUserId) {
      throw new Error('No se puede marcar como asignada sin responsable.');
    }

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
