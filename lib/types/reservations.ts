export type ReservationEntityStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface ReservationEntity {
  id: string;
  clientId: string;
  buildingId: string;
  unitId: string;
  commonAreaId: string;
  createdByUserId: string;
  startAt: string;
  endAt: string;
  status: ReservationEntityStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  deletedAt?: string | null;
}

