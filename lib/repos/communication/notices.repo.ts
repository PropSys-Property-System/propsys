import { Notice, NoticeEntity, User } from '@/lib/types';
import { MOCK_NOTICE_ENTITIES } from '@/lib/mocks';
import { canBypassTenantScope, filterItemsByTenant } from '@/lib/auth/access-rules';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { auditService } from '@/lib/audit/audit-service';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toLegacyNotice(n: NoticeEntity): Notice {
  return {
    id: n.id,
    clientId: n.clientId,
    audience: n.audience,
    buildingId: n.buildingId,
    title: n.title,
    body: n.body,
    createdAt: n.publishedAt ?? n.createdAt,
  };
}

export const noticesRepo = {
  async listForUser(user: User): Promise<Notice[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ notices: Notice[] }>('/api/v1/notices', { credentials: 'include' });
      return data.notices;
    }
    await sleep(250);

    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
    const tenantScoped = filterItemsByTenant(MOCK_NOTICE_ENTITIES, user);

    const published = tenantScoped.filter((n) => n.status === 'PUBLISHED' && !n.deletedAt);
    const forAll = published.filter((n) => n.audience === 'ALL_BUILDINGS');
    const forBuildings = published.filter((n) => n.audience === 'BUILDING' && !!n.buildingId && buildingIds.includes(n.buildingId));

    return [...forAll, ...forBuildings].map(toLegacyNotice);
  },

  async createAndPublishForUser(
    user: User,
    input: Pick<NoticeEntity, 'audience' | 'buildingId' | 'title' | 'body'> & { clientId?: string }
  ): Promise<NoticeEntity> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { notice?: NoticeEntity; error?: string } | null;
      if (!res.ok || !data?.notice) throw new Error(data?.error || 'No autorizado');
      return data.notice;
    }
    await sleep(250);

    if (user.internalRole === 'STAFF' || user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
      throw new Error('No autorizado');
    }

    const isRootPlatform = canBypassTenantScope(user);
    if (!isRootPlatform && !user.clientId) {
      throw new Error('No autorizado');
    }

    const selectedClientId = isRootPlatform ? input.clientId : user.clientId;
    if (!selectedClientId) {
      throw new Error('Selecciona un cliente para publicar el aviso.');
    }

    if (input.audience === 'BUILDING') {
      if (!input.buildingId) throw new Error('No autorizado');

      const building = (await buildingsRepo.listForUser(user)).find((b) => b.id === input.buildingId) ?? null;
      if (!building || (building.clientId && building.clientId !== selectedClientId)) {
        throw new Error('El edificio no pertenece al cliente seleccionado.');
      }

      if (user.internalRole === 'BUILDING_ADMIN' && !assignmentsRepo.isAssignedToBuilding(user, input.buildingId)) {
        throw new Error('No autorizado: no estás asignado a ese edificio.');
      }
    }

    if (input.audience === 'ALL_BUILDINGS' && user.internalRole === 'BUILDING_ADMIN') {
      throw new Error('No autorizado: solo puedes publicar avisos para tu edificio.');
    }

    const now = new Date().toISOString();
    const entity: NoticeEntity = {
      id: `notice_${Date.now()}`,
      clientId: selectedClientId,
      audience: input.audience,
      buildingId: input.audience === 'BUILDING' ? input.buildingId : undefined,
      title: input.title,
      body: input.body,
      status: 'PUBLISHED',
      createdByUserId: user.id,
      createdAt: now,
      publishedAt: now,
      updatedAt: now,
    };

    MOCK_NOTICE_ENTITIES.unshift(entity);

    auditService.logAction({
      userId: user.id,
      clientId: entity.clientId,
      action: 'CREATE',
      entity: 'Notice',
      entityId: entity.id,
      newData: entity,
      metadata: { audience: entity.audience, buildingId: entity.buildingId },
    });

    return entity;
  },
};
