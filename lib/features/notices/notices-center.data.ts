import { noticesRepo } from '@/lib/repos/communication/notices.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import type { Notice, NoticeEntity, User } from '@/lib/types';

export type NoticeBuildingOption = {
  id: string;
  name: string;
  clientId?: string;
};

export type AdminNoticesPageData = {
  notices: Notice[];
  buildings: NoticeBuildingOption[];
  defaultBuildingId: string;
  defaultAudience: Notice['audience'];
};

export type ResidentNoticesPageData = {
  notices: Notice[];
};

export type CreateNoticeInput = Pick<NoticeEntity, 'audience' | 'buildingId' | 'title' | 'body'> & {
  clientId?: string;
};

export async function loadAdminNoticesPageData(user: User): Promise<AdminNoticesPageData> {
  const [notices, buildings] = await Promise.all([noticesRepo.listForUser(user), buildingsRepo.listForUser(user)]);

  return {
    notices,
    buildings: buildings.map((building) => ({ id: building.id, name: building.name, clientId: building.clientId })),
    defaultBuildingId: buildings[0]?.id ?? '',
    defaultAudience: user.internalRole === 'BUILDING_ADMIN' ? 'BUILDING' : 'ALL_BUILDINGS',
  };
}

export async function listNoticesForUser(user: User): Promise<Notice[]> {
  return noticesRepo.listForUser(user);
}

export async function loadResidentNoticesPageData(user: User): Promise<ResidentNoticesPageData> {
  return {
    notices: await noticesRepo.listForUser(user),
  };
}

export async function createNoticeForUser(user: User, input: CreateNoticeInput): Promise<NoticeEntity> {
  return noticesRepo.createAndPublishForUser(user, input);
}
