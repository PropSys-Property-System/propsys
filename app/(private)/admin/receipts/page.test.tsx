import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminReceiptsPage from './page';

const mocks = vi.hoisted(() => {
  const managerUser = {
    id: 'u_manager',
    name: 'Manager',
    email: 'manager@propsys.com',
    role: 'MANAGER',
    internalRole: 'CLIENT_MANAGER',
    clientId: 'client_001',
    scope: 'client',
    status: 'ACTIVE',
  };

  return {
    managerUser,
    createAdminReceipt: vi.fn(),
    listAdminReceiptPaymentProofs: vi.fn(() => new Promise(() => undefined)),
    loadAdminReceiptsPageData: vi.fn(() => new Promise(() => undefined)),
    reviewReceiptPaymentProof: vi.fn(),
    updateAdminReceiptStatus: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: mocks.managerUser,
  }),
}));

vi.mock('@/lib/features/receipts/receipts-center.data', () => ({
  createAdminReceipt: mocks.createAdminReceipt,
  listAdminReceiptPaymentProofs: mocks.listAdminReceiptPaymentProofs,
  loadAdminReceiptsPageData: mocks.loadAdminReceiptsPageData,
  reviewReceiptPaymentProof: mocks.reviewReceiptPaymentProof,
  updateAdminReceiptStatus: mocks.updateAdminReceiptStatus,
}));

describe('admin receipts page actions', () => {
  beforeEach(() => {
    mocks.createAdminReceipt.mockReset();
    mocks.reviewReceiptPaymentProof.mockReset();
    mocks.updateAdminReceiptStatus.mockReset();
    mocks.listAdminReceiptPaymentProofs.mockReset().mockImplementation(() => new Promise(() => undefined));
    mocks.loadAdminReceiptsPageData.mockReset().mockImplementation(() => new Promise(() => undefined));
  });

  it('renders the export csv button while loading', () => {
    render(<AdminReceiptsPage />);

    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeInTheDocument();
  });
});
