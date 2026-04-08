import { Client } from '../types/core';
import { UserV2 } from '../types/auth';

/**
 * Mocks base del sistema Core (SaaS).
 */

export const MOCK_CLIENTS: Client[] = [
  {
    id: 'client_001',
    name: 'PropSys Administraciones Globales',
    taxId: '800.123.456-7',
    status: 'ACTIVE',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'client_002',
    name: 'Gestión Residencial Sur',
    taxId: '900.987.654-3',
    status: 'ACTIVE',
    createdAt: '2025-02-15T00:00:00Z',
    updatedAt: '2025-02-15T00:00:00Z'
  }
];

export const MOCK_USERS_V2: UserV2[] = [
  {
    id: 'user_root',
    email: 'root@propsys.io',
    name: 'Root Admin',
    internalRole: 'ROOT_ADMIN',
    clientId: null,
    scope: 'platform',
    status: 'ACTIVE',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'user_manager_c1',
    email: 'manager@propsys.com',
    name: 'Gerente Cliente 1',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    createdAt: '2025-01-05T10:00:00Z',
    updatedAt: '2025-01-05T10:00:00Z'
  },
  {
    id: 'user_admin_b1',
    email: 'building.admin@propsys.com',
    name: 'Admin de Edificio 1',
    internalRole: 'BUILDING_ADMIN',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
    createdAt: '2025-01-10T15:00:00Z',
    updatedAt: '2025-01-10T15:00:00Z'
  }
];
