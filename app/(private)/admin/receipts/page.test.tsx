import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminReceiptsPage from './page';
import type { ReceiptPaymentProofView } from '@/lib/types';

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
    push: vi.fn(),
    refresh: vi.fn(),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
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

vi.mock('@/lib/features/receipts/receipts-center.ui', () => ({
  AdminPaymentProofsPanel: ({
    proofs,
    onApprove,
    onReject,
  }: {
    proofs: ReceiptPaymentProofView[];
    onApprove: (proofId: string) => void;
    onReject: (proofId: string) => void;
  }) => (
    <div>
      <div>Comprobantes pendientes</div>
      {proofs.map((proof) => (
        <div key={proof.id}>
          <span>{proof.id}</span>
          <button onClick={() => onApprove(proof.id)}>Aprobar comprobante</button>
          <button onClick={() => onReject(proof.id)}>Rechazar comprobante</button>
        </div>
      ))}
    </div>
  ),
  AdminReceiptsList: () => <div>Receipts list</div>,
  AdminReceiptsWorkspaceSkeleton: () => <div>Loading receipts</div>,
  ReceiptComposerDialog: () => null,
}));

describe('admin receipts page actions', () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.createAdminReceipt.mockReset();
    mocks.reviewReceiptPaymentProof.mockReset().mockResolvedValue({
      proof: { id: 'proof_1', receiptId: 'receipt_1', status: 'APPROVED' },
      receipt: { id: 'receipt_1', status: 'PAID' },
    });
    mocks.updateAdminReceiptStatus.mockReset();
    mocks.listAdminReceiptPaymentProofs.mockReset().mockResolvedValue([
      {
        id: 'proof_1',
        receiptId: 'receipt_1',
        fileUrl: 'https://example.com/proof.pdf',
        uploadedAt: '2026-06-20T10:00:00.000Z',
        status: 'PENDING_REVIEW',
      },
    ]);
    mocks.loadAdminReceiptsPageData.mockReset().mockResolvedValue({
      receipts: [
        {
          id: 'receipt_1',
          buildingId: 'b1',
          unitId: 'unit_1',
          number: 'REC-001',
          description: 'Expensas junio',
          amount: 100,
          currency: 'PEN',
          issueDate: '2026-06-01',
          dueDate: '2026-06-10',
          status: 'PENDING',
        },
      ],
      buildings: [{ id: 'b1', name: 'Torre Norte', clientId: 'client_001' }],
      units: [{ id: 'unit_1', buildingId: 'b1', number: '101' }],
    });
  });

  it('renders the export csv button while loading', () => {
    render(<AdminReceiptsPage />);

    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeInTheDocument();
  });

  it('refreshes after approving a payment proof successfully', async () => {
    render(<AdminReceiptsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar comprobante' }));

    await waitFor(() => {
      expect(mocks.reviewReceiptPaymentProof).toHaveBeenCalledWith(
        mocks.managerUser,
        expect.objectContaining({ proofId: 'proof_1', action: 'APPROVE' })
      );
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('does not refresh when reviewing a payment proof fails', async () => {
    mocks.reviewReceiptPaymentProof.mockRejectedValueOnce(new Error('boom'));
    render(<AdminReceiptsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar comprobante' }));

    await waitFor(() => {
      expect(mocks.reviewReceiptPaymentProof).toHaveBeenCalledWith(
        mocks.managerUser,
        expect.objectContaining({ proofId: 'proof_1', action: 'REJECT' })
      );
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
