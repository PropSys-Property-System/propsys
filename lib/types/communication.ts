export type NoticeAudience = 'BUILDING' | 'ALL_BUILDINGS';
export type NoticeStatus = 'DRAFT' | 'PUBLISHED';

export interface NoticeEntity {
  id: string;
  clientId: string;
  audience: NoticeAudience;
  buildingId?: string;
  title: string;
  body: string;
  status: NoticeStatus;
  createdByUserId: string;
  createdAt: string;
  publishedAt?: string;
  updatedAt: string;
  deletedAt?: string | null;
}

