import { User, Receipt, Building, Unit } from '../types';

export const MOCK_ADMIN: User = {
  id: 'u1',
  email: 'admin@propsys.com',
  name: 'Admin User',
  role: 'ADMIN',
};

export const MOCK_STAFF: User = {
  id: 'u2',
  email: 'staff@propsys.com',
  name: 'Staff Member',
  role: 'STAFF',
};

export const MOCK_RESIDENT: User = {
  id: 'u3',
  email: 'resident@propsys.com',
  name: 'Resident User',
  role: 'RESIDENT',
  buildingId: 'b1',
  unitId: 'unit-101',
};

export const MOCK_BUILDINGS: Building[] = [
  { id: 'b1', name: 'Torre Alerce', address: 'Av. Siempre Viva 123', city: 'Santiago' },
  { id: 'b2', name: 'Edificio Roble', address: 'Calle Falsa 456', city: 'Santiago' },
];

export const MOCK_UNITS: Unit[] = [
  { id: 'unit-101', buildingId: 'b1', number: '101', floor: '1' },
  { id: 'unit-102', buildingId: 'b1', number: '102', floor: '1' },
  { id: 'unit-201', buildingId: 'b2', number: '201', floor: '2' },
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
];
