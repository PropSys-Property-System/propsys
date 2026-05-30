import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ResidentReceiptsPage from './page';

const mocks = vi.hoisted(() => {
  const ownerUser = {
    id: 'u_owner',
    name: 'Owner',
    role: 'RESIDENT',
    internalRole: 'OWNER',
    clientId: 'client_001',
  };

  return {
    ownerUser,
    loadResidentReceiptsPageData: vi.fn(() => new Promise(() => undefined)),
    listReceiptPaymentProofsForReceipt: vi.fn(),
    buildResidentUnitFilterOptions: vi.fn(() => []),
    filterAndSortResidentReceipts: vi.fn(() => []),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: mocks.ownerUser,
  }),
}));

vi.mock('@/lib/features/receipts/receipts-center.data', () => ({
  buildResidentUnitFilterOptions: mocks.buildResidentUnitFilterOptions,
  filterAndSortResidentReceipts: mocks.filterAndSortResidentReceipts,
  listReceiptPaymentProofsForReceipt: mocks.listReceiptPaymentProofsForReceipt,
  loadResidentReceiptsPageData: mocks.loadResidentReceiptsPageData,
}));

describe('resident receipts loading state', () => {
  beforeEach(() => {
    mocks.loadResidentReceiptsPageData.mockReset().mockImplementation(() => new Promise(() => undefined));
    mocks.listReceiptPaymentProofsForReceipt.mockReset().mockResolvedValue([]);
    mocks.buildResidentUnitFilterOptions.mockReset().mockReturnValue([]);
    mocks.filterAndSortResidentReceipts.mockReset().mockReturnValue([]);
  });

  it('renders a skeleton without provisional zero amounts while loading', () => {
    render(<ResidentReceiptsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando recibos...');
    expect(screen.queryByText(/0[.,]00/)).not.toBeInTheDocument();
  });

  it('shows Sin pagos instead of a zero amount when there is no previous payment', async () => {
    mocks.loadResidentReceiptsPageData.mockResolvedValue({ receipts: [], buildings: [], units: [] });

    render(<ResidentReceiptsPage />);

    const latestPaymentLabel = await screen.findByText('Último pago');
    expect(latestPaymentLabel.parentElement).toHaveTextContent('Sin pagos');
    expect(latestPaymentLabel.parentElement).not.toHaveTextContent(/0[.,]00/);
  });

  it('renders a single empty-state container when no receipts exist', async () => {
    mocks.loadResidentReceiptsPageData.mockResolvedValue({ receipts: [], buildings: [], units: [] });

    render(<ResidentReceiptsPage />);

    expect(await screen.findByRole('heading', { name: 'No tienes recibos' })).toBeInTheDocument();
    expect(document.querySelectorAll('.border-dashed')).toHaveLength(1);
  });
});
