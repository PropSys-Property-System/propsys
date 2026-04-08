import {
  User,
  Receipt,
  Building,
  Unit,
  StaffMember,
  CommonArea,
  Reservation,
  Notice,
  Ticket,
} from '../types';

export const MOCK_ROOT_ADMIN: User = {
  id: 'u0',
  email: 'root@propsys.io',
  name: 'Super Administrador',
  role: 'MANAGER',
  internalRole: 'ROOT_ADMIN',
  clientId: null,
  scope: 'platform',
  status: 'ACTIVE',
};

export const MOCK_MANAGER: User = {
  id: 'u1',
  email: 'manager@propsys.com',
  name: 'Gestora Principal',
  role: 'MANAGER',
  internalRole: 'CLIENT_MANAGER',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
};

export const MOCK_BUILDING_ADMIN: User = {
  id: 'u2',
  email: 'building.admin@propsys.com',
  name: 'Administrador Edificio',
  role: 'BUILDING_ADMIN',
  internalRole: 'BUILDING_ADMIN',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
  buildingId: 'b1',
};

export const MOCK_STAFF: User = {
  id: 'u3',
  email: 'staff@propsys.com',
  name: 'Staff Operativo',
  role: 'STAFF',
  internalRole: 'STAFF',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
  buildingId: 'b1',
};

export const MOCK_OWNER: User = {
  id: 'u4',
  email: 'owner@propsys.com',
  name: 'Propietaria Carla',
  role: 'OWNER',
  internalRole: 'OWNER',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
  buildingId: 'b1',
  unitId: 'unit-101',
};

export const MOCK_TENANT: User = {
  id: 'u5',
  email: 'tenant@propsys.com',
  name: 'Inquilino Juan',
  role: 'TENANT',
  internalRole: 'OCCUPANT',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
  buildingId: 'b1',
  unitId: 'unit-102',
};

export const MOCK_USERS: User[] = [MOCK_MANAGER, MOCK_BUILDING_ADMIN, MOCK_STAFF, MOCK_OWNER, MOCK_TENANT];

export const MOCK_BUILDINGS: Building[] = [
  { id: 'b1', name: 'Torre Alerce', address: 'Av. Siempre Viva 123', city: 'Santiago' },
  { id: 'b2', name: 'Edificio Roble', address: 'Calle Falsa 456', city: 'Santiago' },
];

export const MOCK_UNITS: Unit[] = [
  { id: 'unit-101', buildingId: 'b1', number: '101', floor: '1', ownerId: 'u4' },
  { id: 'unit-102', buildingId: 'b1', number: '102', floor: '1', ownerId: 'u4', residentId: 'u5' },
  { id: 'unit-201', buildingId: 'b2', number: '201', floor: '2', ownerId: 'u4' },
];

export const MOCK_RECEIPTS: Receipt[] = [
  {
    id: 'r1',
    number: 'REC-001',
    issueDate: '2026-03-01',
    dueDate: '2026-03-10',
    amount: 150000,
    currency: 'CLP',
    status: 'PAID',
    description: 'Gastos Comunes Marzo 2026',
    unitId: 'unit-101',
    buildingId: 'b1',
  },
  {
    id: 'r2',
    number: 'REC-002',
    issueDate: '2026-04-01',
    dueDate: '2026-04-10',
    amount: 155000,
    currency: 'CLP',
    status: 'PENDING',
    description: 'Gastos Comunes Abril 2026',
    unitId: 'unit-101',
    buildingId: 'b1',
  },
  {
    id: 'r3',
    number: 'REC-003',
    issueDate: '2026-03-01',
    dueDate: '2026-03-10',
    amount: 120000,
    currency: 'CLP',
    status: 'OVERDUE',
    description: 'Gastos Comunes Marzo 2026',
    unitId: 'unit-102',
    buildingId: 'b1',
  },
  {
    id: 'r4',
    number: 'REC-101',
    issueDate: '2026-04-01',
    dueDate: '2026-04-10',
    amount: 98000,
    currency: 'CLP',
    status: 'PENDING',
    description: 'Gastos Comunes Abril 2026',
    unitId: 'unit-201',
    buildingId: 'b2',
  },
];

export const MOCK_STAFF_MEMBERS: StaffMember[] = [
  { id: 's1', buildingId: 'b1', name: 'María Torres', role: 'Conserjería', phone: '+56 9 1111 1111', shift: 'Día', status: 'ACTIVE' },
  { id: 's2', buildingId: 'b1', name: 'Pedro Rojas', role: 'Seguridad', phone: '+56 9 2222 2222', shift: 'Noche', status: 'ACTIVE' },
  { id: 's3', buildingId: 'b1', name: 'Ana Silva', role: 'Limpieza', phone: '+56 9 3333 3333', shift: 'Mañana', status: 'ACTIVE' },
  { id: 's4', buildingId: 'b2', name: 'Carlos Vera', role: 'Conserjería', shift: 'Día', status: 'ACTIVE' },
];

export const MOCK_COMMON_AREAS: CommonArea[] = [
  { id: 'ca1', buildingId: 'b1', name: 'Quincho', capacity: 15, requiresApproval: true },
  { id: 'ca2', buildingId: 'b1', name: 'Sala Multiuso', capacity: 30, requiresApproval: true },
  { id: 'ca3', buildingId: 'b1', name: 'Gimnasio', capacity: 10, requiresApproval: false },
  { id: 'ca4', buildingId: 'b2', name: 'Piscina', capacity: 20, requiresApproval: true },
];

export const MOCK_RESERVATIONS: Reservation[] = [
  {
    id: 'resv-1',
    buildingId: 'b1',
    unitId: 'unit-101',
    commonAreaId: 'ca1',
    createdByUserId: 'u4',
    startAt: '2026-04-05T19:00:00.000Z',
    endAt: '2026-04-05T22:00:00.000Z',
    status: 'APPROVED',
  },
  {
    id: 'resv-2',
    buildingId: 'b1',
    unitId: 'unit-102',
    commonAreaId: 'ca2',
    createdByUserId: 'u5',
    startAt: '2026-04-08T18:00:00.000Z',
    endAt: '2026-04-08T20:00:00.000Z',
    status: 'REQUESTED',
  },
];

export const MOCK_NOTICES: Notice[] = [
  {
    id: 'n1',
    audience: 'BUILDING',
    buildingId: 'b1',
    title: 'Mantención Ascensor',
    body: 'El ascensor estará en mantención el viernes 05/04 entre 10:00 y 13:00.',
    createdAt: '2026-04-01T12:00:00.000Z',
  },
  {
    id: 'n2',
    audience: 'ALL_BUILDINGS',
    title: 'Actualización PropSys',
    body: 'Estamos mejorando el portal. Algunas funciones estarán en modo beta esta semana.',
    createdAt: '2026-04-02T09:00:00.000Z',
  },
];

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 't1',
    buildingId: 'b1',
    unitId: 'unit-102',
    createdByUserId: 'u5',
    title: 'Fuga de agua en cocina',
    description: 'Se detecta filtración bajo el lavaplatos. Se requiere revisión.',
    status: 'OPEN',
    priority: 'HIGH',
    createdAt: '2026-04-03T08:30:00.000Z',
  },
  {
    id: 't2',
    buildingId: 'b1',
    createdByUserId: 'u2',
    title: 'Luz pasillo piso 1',
    description: 'Se reporta luminaria intermitente en pasillo del piso 1.',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdAt: '2026-04-03T10:15:00.000Z',
  },
];
