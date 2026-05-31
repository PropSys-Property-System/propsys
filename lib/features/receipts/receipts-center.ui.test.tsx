import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminReceiptDetailView,
  AdminPaymentProofsPanel,
  AdminReceiptHeaderActions,
  AdminReceiptsWorkspaceSkeleton,
  ReceiptDetailSkeleton,
  ResidentReceiptDetailView,
  ResidentReceiptHeaderActions,
  ResidentReceiptsList,
  ResidentReceiptsSkeleton,
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

  it('allows a new upload when the latest proof was rejected', () => {
    const onUpload = vi.fn();
    render(
      <ResidentPaymentProofPanel
        receipt={receipt}
        proofs={[proof({ status: 'REJECTED', reviewComment: 'No legible' })]}
        selectedFile={null}
        note=""
        isSubmitting={false}
        onFileChange={vi.fn()}
        onNoteChange={vi.fn()}
        onUpload={onUpload}
      />
    );

    expect(screen.getAllByText('Rechazado').length).toBeGreaterThan(0);
    expect(screen.getByText(/comprobante anterior fue rechazado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /subir comprobante/i }));
    expect(onUpload).toHaveBeenCalledTimes(1);
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

  it('labels compact admin receipt header actions', () => {
    render(<AdminReceiptHeaderActions receipt={receipt} onEdit={vi.fn()} onPrint={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Editar recibo' })).toHaveAttribute('aria-label', 'Editar recibo');
    expect(screen.getByRole('button', { name: 'Imprimir recibo' })).toHaveAttribute('aria-label', 'Imprimir recibo');
  });

  it('renders resident print action in the detail header', () => {
    render(<ResidentReceiptHeaderActions receipt={receipt} receiptStatus={receipt.status} onPrint={vi.fn()} />);

    expect(screen.getByRole('button', { name: /imprimir \/ guardar pdf/i })).toBeInTheDocument();
  });

  it('renders resident receipt loading UI without provisional financial values', () => {
    render(<ResidentReceiptsSkeleton />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando recibos...');
    expect(screen.queryByText(/0[.,]00/)).not.toBeInTheDocument();
  });

  it('renders admin receipt workspace loading UI', () => {
    render(<AdminReceiptsWorkspaceSkeleton />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando recibos...');
  });

  it('renders shared receipt detail loading UI', () => {
    render(<ReceiptDetailSkeleton />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando recibo...');
  });

  it('renders receipt detail proofs without requiring pendingReceipts', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const { container } = render(
      <AdminPaymentProofsPanel
        receipt={receipt}
        proofs={[
          proof({
            id: 'rpp_rejected',
            status: 'REJECTED',
            fileName: 'rechazado.pdf',
            reviewComment: 'No legible',
            createdAt: '2026-05-05T10:00:00.000Z',
          }),
          proof({
            id: 'rpp_pending',
            status: 'PENDING_REVIEW',
            fileName: 'nuevo.pdf',
            createdAt: '2026-05-04T10:00:00.000Z',
          }),
        ]}
        pendingActionId={null}
        reviewComments={{}}
        emptyDescription="Este recibo aún no tiene comprobantes registrados."
        buildingById={new Map([['b1', { id: 'b1', name: 'Torre Alerce' }]])}
        unitById={new Map([['unit_1', { id: 'unit_1', buildingId: 'b1', number: '101' }]])}
        onOpenProof={vi.fn()}
        onReviewCommentChange={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
      />
    );

    expect(screen.getByText('REC-001')).toBeInTheDocument();
    expect(screen.getByText('nuevo.pdf')).toBeInTheDocument();
    expect(screen.getByText('rechazado.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Comentario: No legible/)).toBeInTheDocument();
    expect(screen.queryByText('Este recibo aún no tiene comprobantes registrados.')).not.toBeInTheDocument();
    const renderedText = container.textContent ?? '';
    expect(renderedText.indexOf('nuevo.pdf')).toBeLessThan(renderedText.indexOf('rechazado.pdf'));

    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));
    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    expect(onApprove).toHaveBeenCalledWith('rpp_pending');
    expect(onReject).toHaveBeenCalledWith('rpp_pending');
  });

  it('shows receipt detail empty state only when the receipt has no proofs', () => {
    render(
      <AdminPaymentProofsPanel
        receipt={receipt}
        proofs={[]}
        pendingActionId={null}
        reviewComments={{}}
        emptyDescription="Este recibo aún no tiene comprobantes registrados."
        onOpenProof={vi.fn()}
        onReviewCommentChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText('Este recibo aún no tiene comprobantes registrados.')).toBeInTheDocument();
    expect(screen.queryByText('REC-001')).not.toBeInTheDocument();
  });

  it('renders rejected receipt detail proofs as history without review actions', () => {
    render(
      <AdminPaymentProofsPanel
        receipt={receipt}
        proofs={[proof({ status: 'REJECTED', fileName: 'rechazado.pdf', reviewComment: 'No coincide' })]}
        pendingActionId={null}
        reviewComments={{}}
        onOpenProof={vi.fn()}
        onReviewCommentChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText('rechazado.pdf')).toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
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

  it('marks the admin receipt detail for clean printing and keeps core fields visible', () => {
    render(
      <AdminReceiptDetailView
        receipt={receipt}
        building={{ id: 'b1', clientId: 'client_001', name: 'Torre Alerce', address: 'Calle 123', city: 'Lima' }}
        unit={{ id: 'unit_1', buildingId: 'b1', number: '101', floor: '1', ownerId: 'u_owner', residentId: 'u_resident' }}
        actions={<div>Acciones</div>}
        paymentProofPanel={<div>Panel secundario</div>}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByTestId('receipt-print-root')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print-document')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print-card')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print-actions')).toHaveClass('print-hidden');
    expect(screen.getByTestId('receipt-print-secondary')).toHaveClass('print-hidden');
    expect(screen.getByTestId('receipt-print-critical-actions')).toHaveClass('print-hidden');
    const printRoot = screen.getByTestId('receipt-print-root');
    const printCard = screen.getByTestId('receipt-print-card');
    expect(within(printRoot).getByText('Recibo REC-001')).toBeInTheDocument();
    expect(within(printRoot).getByText('Mantenimiento')).toBeInTheDocument();
    expect(within(printCard).getAllByText('Torre Alerce').length).toBeGreaterThan(0);
    expect(within(printCard).getAllByText('Unidad 101').length).toBeGreaterThan(0);
    expect(within(printCard).getByText(/150/)).toBeInTheDocument();
  });

  it('marks the resident receipt detail secondary panels as hidden for printing', () => {
    render(
      <ResidentReceiptDetailView
        receipt={receipt}
        building={{ id: 'b1', clientId: 'client_001', name: 'Torre Alerce', address: 'Calle 123', city: 'Lima' }}
        unit={{ id: 'unit_1', buildingId: 'b1', number: '101', floor: '1', ownerId: 'u_owner', residentId: 'u_resident' }}
        actions={<div>Acciones</div>}
        paymentProofPanel={<div>Panel secundario</div>}
      />
    );

    expect(screen.getByTestId('receipt-print-root')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print-document')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print-card')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-print-actions')).toHaveClass('print-hidden');
    expect(screen.getByTestId('receipt-print-secondary')).toHaveClass('print-hidden');
    expect(screen.getByTestId('receipt-print-footer')).toHaveClass('print-hidden');
    const printRoot = screen.getByTestId('receipt-print-root');
    const printCard = screen.getByTestId('receipt-print-card');
    expect(within(printRoot).getByText('REC-001')).toBeInTheDocument();
    expect(within(printRoot).getByText('Mantenimiento')).toBeInTheDocument();
    expect(within(printCard).getAllByText('Torre Alerce').length).toBeGreaterThan(0);
    expect(within(printCard).getAllByText('Depto 101').length).toBeGreaterThan(0);
    expect(within(printCard).getByText(/150/)).toBeInTheDocument();
  });
});
