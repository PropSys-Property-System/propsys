import { NoticeEntity } from '@/lib/types';

export const MOCK_NOTICE_ENTITIES: NoticeEntity[] = [
  {
    id: 'n1',
    clientId: 'client_001',
    audience: 'BUILDING',
    buildingId: 'b1',
    title: 'Mantención de ascensor',
    body: 'El ascensor estará en mantención el viernes 05/04 entre 10:00 y 13:00.',
    status: 'PUBLISHED',
    createdByUserId: 'u2',
    createdAt: '2026-04-01T12:00:00.000Z',
    publishedAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
  },
  {
    id: 'n2',
    clientId: 'client_001',
    audience: 'ALL_BUILDINGS',
    title: 'Actualización del portal',
    body: 'Estamos mejorando el portal. Algunas funciones estarán en modo beta esta semana.',
    status: 'PUBLISHED',
    createdByUserId: 'u2',
    createdAt: '2026-04-02T09:00:00.000Z',
    publishedAt: '2026-04-02T09:00:00.000Z',
    updatedAt: '2026-04-02T09:00:00.000Z',
  },
  {
    id: 'n3',
    clientId: 'client_002',
    audience: 'BUILDING',
    buildingId: 'b3',
    title: 'Corte de agua programado',
    body: 'Se realizará un corte de agua el martes 09/04 entre 09:00 y 11:00.',
    status: 'PUBLISHED',
    createdByUserId: 'u2',
    createdAt: '2026-04-03T08:00:00.000Z',
    publishedAt: '2026-04-03T08:00:00.000Z',
    updatedAt: '2026-04-03T08:00:00.000Z',
  },
];

