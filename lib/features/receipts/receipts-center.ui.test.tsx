import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminPaymentProofsPanel,
  ResidentReceiptsList,
  ResidentPaymentProofPanel,
} from './receipts-center.ui';
import type { Receipt, ReceiptPaymentProofView } from '@/lib/types';

const receipt: Receipt = {
  id: 'rect_1',
  buildingId: 'b1',
  unitId: 'unit_1',
  number: 'REC-001',
  description: 'Mantenimiento',
  amount: 150,
  currency: 'PEN',
  issueDate: '2026-05-01',
  dueDate: '2026-05-10',
  status: 'PENDING',
};

function proof(overrides: Partial<ReceiptPaymentProofView> = {}): ReceiptPaymentProofView {
  return {
    id: 'rpp_1',
    clientId: 'client_001',
    buildingId: 'b1',
    unitId: 'unit_1',
    receiptId: 'rect_1',
    uploadedByUserId: 'u_owner',
    fileName: 'comprobante.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    note: 'Transferencia',
    status: 'PENDING_REVIEW',
    reviewedByUserId: null,
    reviewedAt: null,
    reviewComment: null,
    deletedAt: null,
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
    fileUrl: '/api/v1/finance/payment-proofs/rpp_1',
    ...overrides,
  };
}

describe('payment proof receipt UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a resident upload form for a pending receipt without an active proof', () => {
    const onUpload = vi.fn();
    render(
      <ResidentPaymentProofPanel
        receipt={receipt}
        proofs={[]}
        selectedFile={null}
        note=""
        isSubmitting={false}
        onFileChange={vi.fn()}
        onNoteChange={vi.fn()}
        onUpload={onUpload}
      />
    );

    expect(screen.getByText('Subir comprobante')).toBeInTheDocument();
    expect(screen.getByLabelText('Archivo del comprobante')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /subir comprobante/i }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('blocks a second upload while a proof is pending review', () => {
    render(
      <ResidentPaymentProofPanel
        receipt={receipt}
        proofs={[proof()]}
        selectedFile={null}
        note=""
        isSubmitting={false}
        onFileChange={vi.fn()}
        onNoteChange={vi.fn()}
        onUpload={vi.fn()}
      />
    );

    expect(screen.getAllByText('Pendiente de revisión').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /subir comprobante/i })).not.toBeInTheDocument();
  });

  it('renders admin review actions for pending proofs', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    render(
      <AdminPaymentProofsPanel
        proofs={[proof()]}
        pendingReceipts={[receipt]}
        pendingActionId={null}
        reviewComments={{}}
        buildingById={new Map([['b1', { id: 'b1', name: 'Torre Alerce' }]])}
        unitById={new Map([['unit_1', { id: 'unit_1', buildingId: 'b1', number: '101' }]])}
        onOpenProof={vi.fn()}
        onReviewCommentChange={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(screen.getByText('REC-001')).toBeInTheDocument();
    expect(screen.getByText(/Torre Alerce.*Unidad 101/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    expect(onApprove).toHaveBeenCalledWith('rpp_1');
    expect(onReject).toHaveBeenCalledWith('rpp_1');
  });

  it('navigates with receipt.id while keeping receipt.number as display text', () => {
    const onView = vi.fn();
    render(
      <ResidentReceiptsList
        receipts={[receipt]}
        proofsByReceiptId={{}}
        buildingById={new Map([['b1', { id: 'b1', name: 'Torre Alerce' }]])}
        unitById={new Map([['unit_1', { id: 'unit_1', buildingId: 'b1', number: '101' }]])}
        onView={onView}
      />
    );

    expect(screen.getByText('REC-001')).toBeInTheDocument();
    expect(screen.getByText('Torre Alerce')).toBeInTheDocument();
    expect(screen.getByText('Unidad 101')).toBeInTheDocument();
    const row = screen.getByRole('button');
    fireEvent.click(row);
    expect(onView).toHaveBeenCalledWith('rect_1');
  });
});
