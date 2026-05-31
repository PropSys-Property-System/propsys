import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/lib/types';
import { loadNavigationBadges } from './navigation-badges.data';

const mocks = vi.hoisted(() => ({
  fetchJsonOrThrow: vi.fn(),
  headers: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

vi.mock('@/lib/repos/http', () => ({
  fetchJsonOrThrow: mocks.fetchJsonOrThrow,
}));

const baseUser: User = {
  id: 'u1',
  email: 'user@propsys.com',
  name: 'User',
  role: 'TENANT',
  internalRole: 'OCCUPANT',
  clientId: 'client_1',
  scope: 'client',
  status: 'ACTIVE',
};

describe('loadNavigationBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue({ get: vi.fn(() => 'sid=test') });
    mocks.fetchJsonOrThrow.mockResolvedValue({});
  });

  it('returns staff task badge for PENDING and IN_PROGRESS only', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/operation/tasks')) {
        return {
          tasks: [
            { id: 'task_1', status: 'PENDING' },
            { id: 'task_2', status: 'IN_PROGRESS' },
            { id: 'task_3', status: 'COMPLETED' },
          ],
        };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return { incidents: [] };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'STAFF',
      internalRole: 'STAFF',
    });

    expect(badges).toEqual({
      '/staff/tasks': 2,
    });
  });

  it('returns staff tickets badge only for ASSIGNED and IN_PROGRESS incidents', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/operation/tasks')) {
        return { tasks: [] };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return {
          incidents: [
            { id: 'inc_1', status: 'REPORTED' },
            { id: 'inc_2', status: 'ASSIGNED' },
            { id: 'inc_3', status: 'IN_PROGRESS' },
            { id: 'inc_4', status: 'RESOLVED' },
            { id: 'inc_5', status: 'CLOSED' },
          ],
        };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'STAFF',
      internalRole: 'STAFF',
    });

    expect(badges).toEqual({
      '/staff/tickets': 2,
    });
  });

  it('returns admin tickets badge only for REPORTED and RESOLVED incidents', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/reservations')) {
        return { reservations: [] };
      }
      if (String(input).includes('/api/v1/finance/payment-proofs')) {
        return { proofs: [] };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return {
          incidents: [
            { id: 'inc_1', status: 'REPORTED' },
            { id: 'inc_2', status: 'IN_PROGRESS' },
            { id: 'inc_3', status: 'RESOLVED' },
            { id: 'inc_4', status: 'ASSIGNED' },
            { id: 'inc_5', status: 'CLOSED' },
          ],
        };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'MANAGER',
      internalRole: 'BUILDING_ADMIN',
    });

    expect(badges).toEqual({
      '/admin/tickets': 2,
    });
  });

  it('does not return admin tickets badge when there are no REPORTED or RESOLVED incidents', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/reservations')) {
        return { reservations: [] };
      }
      if (String(input).includes('/api/v1/finance/payment-proofs')) {
        return { proofs: [] };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return {
          incidents: [
            { id: 'inc_1', status: 'ASSIGNED' },
            { id: 'inc_2', status: 'IN_PROGRESS' },
            { id: 'inc_3', status: 'CLOSED' },
          ],
        };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'MANAGER',
      internalRole: 'CLIENT_MANAGER',
    });

    expect(badges['/admin/tickets']).toBeUndefined();
  });

  it('returns admin reservations badge only for REQUESTED', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/reservations')) {
        return {
          reservations: [
            { id: 'res_1', status: 'REQUESTED' },
            { id: 'res_2', status: 'APPROVED' },
            { id: 'res_3', status: 'REQUESTED' },
          ],
        };
      }
      if (String(input).includes('/api/v1/finance/payment-proofs')) {
        return { proofs: [] };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return { incidents: [] };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'MANAGER',
      internalRole: 'CLIENT_MANAGER',
    });

    expect(badges).toEqual({
      '/admin/reservations': 2,
    });
  });

  it('returns admin receipts badge only for PENDING_REVIEW proofs', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/reservations')) {
        return { reservations: [] };
      }
      if (String(input).includes('/api/v1/finance/payment-proofs')) {
        return {
          proofs: [
            { id: 'proof_1', receiptId: 'r1', status: 'PENDING_REVIEW' },
            { id: 'proof_2', receiptId: 'r2', status: 'REJECTED' },
            { id: 'proof_3', receiptId: 'r3', status: 'PENDING_REVIEW' },
          ],
        };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return { incidents: [] };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'MANAGER',
      internalRole: 'ROOT_ADMIN',
      scope: 'platform',
      clientId: null,
    });

    expect(badges).toEqual({
      '/admin/receipts': 2,
    });
  });

  it('returns resident receipts badge for PENDING and OVERDUE only', async () => {
    mocks.fetchJsonOrThrow.mockResolvedValue({
      receipts: [
        { id: 'rec_1', status: 'PENDING' },
        { id: 'rec_2', status: 'OVERDUE' },
        { id: 'rec_3', status: 'PAID' },
      ],
    });

    const badges = await loadNavigationBadges(baseUser);

    expect(badges).toEqual({
      '/resident/receipts': 2,
    });
  });

  it('does not return keys with zero count', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/operation/tasks')) {
        return { tasks: [{ id: 'task_1', status: 'COMPLETED' }] };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return { incidents: [{ id: 'inc_1', status: 'CLOSED' }] };
      }
      return {};
    });

    const badges = await loadNavigationBadges({
      ...baseUser,
      role: 'STAFF',
      internalRole: 'STAFF',
    });

    expect(badges).toEqual({});
  });

  it('does not return badges from unrelated roles', async () => {
    mocks.fetchJsonOrThrow.mockResolvedValue({
      receipts: [{ id: 'rec_1', status: 'PENDING' }],
    });

    const badges = await loadNavigationBadges(baseUser);

    expect(badges['/staff/tasks']).toBeUndefined();
    expect(badges['/admin/reservations']).toBeUndefined();
    expect(badges).toEqual({
      '/resident/receipts': 1,
    });
  });

  it('does not throw if reservations badge fails with 401 and preserves other admin badges', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/reservations')) {
        throw new Error('No autorizado');
      }
      if (String(input).includes('/api/v1/finance/payment-proofs')) {
        return {
          proofs: [{ id: 'proof_1', receiptId: 'r1', status: 'PENDING_REVIEW' }],
        };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return { incidents: [] };
      }
      return {};
    });

    await expect(
      loadNavigationBadges({
        ...baseUser,
        role: 'MANAGER',
        internalRole: 'CLIENT_MANAGER',
      })
    ).resolves.toEqual({
      '/admin/receipts': 1,
    });
  });

  it('does not let one staff counter failure affect the other', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/operation/tasks')) {
        throw new Error('No autorizado');
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        return {
          incidents: [{ id: 'inc_1', status: 'ASSIGNED' }],
        };
      }
      return {};
    });

    await expect(
      loadNavigationBadges({
        ...baseUser,
        role: 'STAFF',
        internalRole: 'STAFF',
      })
    ).resolves.toEqual({
      '/staff/tickets': 1,
    });
  });

  it('does not let admin incidents failure affect reservations or receipts badges', async () => {
    mocks.fetchJsonOrThrow.mockImplementation(async (input) => {
      if (String(input).includes('/api/v1/reservations')) {
        return {
          reservations: [{ id: 'res_1', status: 'REQUESTED' }],
        };
      }
      if (String(input).includes('/api/v1/finance/payment-proofs')) {
        return {
          proofs: [{ id: 'proof_1', receiptId: 'r1', status: 'PENDING_REVIEW' }],
        };
      }
      if (String(input).includes('/api/v1/operation/incidents')) {
        throw new Error('No autorizado');
      }
      return {};
    });

    await expect(
      loadNavigationBadges({
        ...baseUser,
        role: 'MANAGER',
        internalRole: 'ROOT_ADMIN',
        scope: 'platform',
        clientId: null,
      })
    ).resolves.toEqual({
      '/admin/reservations': 1,
      '/admin/receipts': 1,
    });
  });
});
