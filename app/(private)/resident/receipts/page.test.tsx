import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ResidentReceiptsPage from './page';

const mocks = vi.hoisted(() => ({
  loadResidentReceiptsPageData: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: {
      id: 'u_owner',
      name: 'Owner',
      role: 'RESIDENT',
      internalRole: 'OWNER',
      clientId: 'client_001',
    },
  }),
}));

vi.mock('@/lib/features/receipts/receipts-center.data', () => ({
  buildResidentUnitFilterOptions: vi.fn(() => []),
  filterAndSortResidentReceipts: vi.fn(() => []),
  listReceiptPaymentProofsForReceipt: vi.fn(),
  loadResidentReceiptsPageData: mocks.loadResidentReceiptsPageData,
}));

describe('resident receipts loading state', () => {
  it('renders a skeleton without provisional zero amounts while loading', () => {
    render(<ResidentReceiptsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando recibos...');
    expect(screen.queryByText(/0[.,]00/)).not.toBeInTheDocument();
  });
});
