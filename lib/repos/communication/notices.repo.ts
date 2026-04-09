import { Notice, NoticeEntity, User } from '@/lib/types';
import { MOCK_NOTICE_ENTITIES } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { assignmentsRepo } from '@/lib/repos/physical/assignments.repo';
import { auditService } from '@/lib/audit/audit-service';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toLegacyNotice(n: NoticeEntity): Notice {
  return {
    id: n.id,
    audience: n.audience,
    buildingId: n.buildingId,
    title: n.title,
    body: n.body,
    createdAt: n.publishedAt ?? n.createdAt,
  };
}

export const noticesRepo = {
  async listForUser(user: User): Promise<Notice[]> {
    await sleep(250);

    const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_NOTICE_ENTITIES
        : user.clientId
          ? MOCK_NOTICE_ENTITIES.filter((n) => n.clientId === user.clientId)
          : [];

    const published = tenantScoped.filter((n) => n.status === 'PUBLISHED' && !n.deletedAt);
    const forAll = published.filter((n) => n.audience === 'ALL_BUILDINGS');
    const forBuildings = published.filter((n) => n.audience === 'BUILDING' && !!n.buildingId && (user.scope === 'platform' || buildingIds.includes(n.buildingId)));

    if (accessScope(user) === 'PORTFOLIO') return [...forAll, ...forBuildings].map(toLegacyNotice);
    if (!user.buildingId) return forAll.map(toLegacyNotice);

    return [...forAll, ...forBuildings.filter((n) => n.buildingId === user.buildingId)].map(toLegacyNotice);
  },

  async createAndPublishForUser(
    user: User,
    input: Pick<NoticeEntity, 'audience' | 'buildingId' | 'title' | 'body'>
  ): Promise<NoticeEntity> {
    await sleep(250);

    if (user.internalRole === 'STAFF' || user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') {
      throw new Error('No autorizado');
    }
    if (user.scope !== 'platform' && !user.clientId) {
      throw new Error('No autorizado');
    }

    if (input.audience === 'BUILDING') {
      if (!input.buildingId) throw new Error('No autorizado');

      if (user.internalRole === 'BUILDING_ADMIN') {
        if (!assignmentsRepo.isAssignedToBuilding(user, input.buildingId)) {
          throw new Error('No autorizado: no estás asignado a ese edificio.');
        }
      }
    }

    if (input.audience === 'ALL_BUILDINGS' && user.internalRole === 'BUILDING_ADMIN') {
      throw new Error('No autorizado: solo puedes publicar avisos para tu edificio.');
    }

    const now = new Date().toISOString();
    const entity: NoticeEntity = {
      id: `notice_${Date.now()}`,
      clientId: user.scope === 'platform' ? (user.clientId ?? 'client_001') : user.clientId!,
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
