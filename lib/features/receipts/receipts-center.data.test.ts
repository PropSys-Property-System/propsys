import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildResidentUnitFilterOptions,
  filterAndSortResidentReceipts,
  loadResidentReceiptDetailData,
  reviewReceiptPaymentProof,
  uploadReceiptPaymentProof,
} from './receipts-center.data';
import { receiptsRepo } from '@/lib/repos/finance/receipts.repo';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import type { User } from '@/lib/types';

const user: User = {
  id: 'u_owner',
  email: 'owner@propsys.com',
  name: 'Owner',
  role: 'OWNER',
  internalRole: 'OWNER',
  clientId: 'client_001',
  scope: 'client',
  status: 'ACTIVE',
};

describe('receipts center payment proof data layer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uploads a resident payment proof as multipart form data', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ proof: { id: 'rpp_1', status: 'PENDING_REVIEW' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const file = new File([new Uint8Array([1, 2, 3])], 'comprobante.pdf', { type: 'application/pdf' });
    const proof = await uploadReceiptPaymentProof(user, { receiptId: 'rect_1', file, note: 'Transferencia' });

    expect(proof.id).toBe('rpp_1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/finance/receipts/rect_1/payment-proofs',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.any(FormData),
      })
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/REC-');
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('note')).toBe('Transferencia');
  });

  it('reviews a payment proof with action and comment', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ proof: { id: 'rpp_1', status: 'APPROVED' }, receipt: { id: 'rect_1', status: 'PAID' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await reviewReceiptPaymentProof(user, { proofId: 'rpp_1', action: 'APPROVE', reviewComment: 'Validado' });

    expect(result.receipt.status).toBe('PAID');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/finance/payment-proofs/rpp_1',
      expect.objectContaining({
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', reviewComment: 'Validado' }),
      })
    );
  });

  it('loads receipt detail using receipt.id as canonical identifier', async () => {
    vi.spyOn(receiptsRepo, 'getByIdForUser').mockResolvedValue({
      id: 'rect_1',
      buildingId: 'b1',
      unitId: 'unit_1',
      number: 'REC-001',
      description: 'Mantenimiento',
      amount: 120,
      currency: 'PEN',
      issueDate: '2026-05-01',
      dueDate: '2026-06-01',
      status: 'PENDING',
    });
    vi.spyOn(buildingsRepo, 'listForUser').mockResolvedValue([
      { id: 'b1', clientId: 'client_001', name: 'Torres Norte', address: 'Av. Central 123', city: 'Lima' },
    ]);
    vi.spyOn(unitsRepo, 'listForUser').mockResolvedValue([
      { id: 'unit_1', clientId: 'client_001', buildingId: 'b1', number: '101', floor: '1' },
    ]);

    const detail = await loadResidentReceiptDetailData(user, 'rect_1');

    expect(receiptsRepo.getByIdForUser).toHaveBeenCalledWith(user, 'rect_1');
    expect(detail.receipt?.id).toBe('rect_1');
    expect(detail.receipt?.number).toBe('REC-001');
  });

  it('builds resident unit filter options from assigned units, including units without receipts', () => {
    const options = buildResidentUnitFilterOptions(
      [
        { id: 'unit_1', buildingId: 'b1', number: '101' },
        { id: 'unit_2', buildingId: 'b2', number: '201' },
      ],
      [
        { id: 'b1', name: 'Torre Norte' },
        { id: 'b2', name: 'Torre Sur' },
      ]
    );

    expect(options).toEqual([
      { id: 'unit_1', label: 'Depto 101 · Torre Norte' },
      { id: 'unit_2', label: 'Depto 201 · Torre Sur' },
    ]);
  });

  it('keeps resident status/sort filters while allowing unit filters with zero receipts', () => {
    const receipts = [
      {
        id: 'rect_1',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-001',
        description: 'Mantenimiento enero',
        amount: 100,
        currency: 'PEN' as const,
        issueDate: '2026-01-01',
        dueDate: '2026-01-10',
        status: 'PENDING' as const,
      },
      {
        id: 'rect_2',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-002',
        description: 'Mantenimiento febrero',
        amount: 220,
        currency: 'PEN' as const,
        issueDate: '2026-02-01',
        dueDate: '2026-02-10',
        status: 'OVERDUE' as const,
      },
      {
        id: 'rect_3',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-003',
        description: 'Mantenimiento marzo',
        amount: 90,
        currency: 'PEN' as const,
        issueDate: '2026-03-01',
        dueDate: '2026-03-10',
        status: 'PAID' as const,
      },
    ];

    const unitWithoutReceipts = filterAndSortResidentReceipts(receipts, '', 'ALL', 'unit_2', 'DUE_ASC');
    expect(unitWithoutReceipts).toHaveLength(0);

    const pendingSortedByAmount = filterAndSortResidentReceipts(receipts, '', 'PENDING', 'ALL', 'AMOUNT_DESC');
    expect(pendingSortedByAmount.map((receipt) => receipt.id)).toEqual(['rect_2', 'rect_1']);
    expect(pendingSortedByAmount.every((receipt) => receipt.status === 'PENDING' || receipt.status === 'OVERDUE')).toBe(true);
  });

  it('orders resident receipts by required action before paid history by default', () => {
    const receipts = [
      {
        id: 'rect_paid_old',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-PAID',
        description: 'Pagado antiguo',
        amount: 80,
        currency: 'PEN' as const,
        issueDate: '2026-01-01',
        dueDate: '2026-01-05',
        status: 'PAID' as const,
      },
      {
        id: 'rect_pending_no_proof',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-PENDING',
        description: 'Pendiente sin comprobante',
        amount: 120,
        currency: 'PEN' as const,
        issueDate: '2026-05-01',
        dueDate: '2026-06-10',
        status: 'PENDING' as const,
      },
      {
        id: 'rect_rejected',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-REJECTED',
        description: 'Requiere reenvio',
        amount: 130,
        currency: 'PEN' as const,
        issueDate: '2026-05-02',
        dueDate: '2026-06-11',
        status: 'PENDING' as const,
      },
      {
        id: 'rect_review',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-REVIEW',
        description: 'En revision',
        amount: 140,
        currency: 'PEN' as const,
        issueDate: '2026-05-03',
        dueDate: '2026-06-12',
        status: 'PENDING' as const,
      },
      {
        id: 'rect_overdue',
        buildingId: 'b1',
        unitId: 'unit_1',
        number: 'REC-OVERDUE',
        description: 'Vencido',
        amount: 150,
        currency: 'PEN' as const,
        issueDate: '2026-04-01',
        dueDate: '2026-04-10',
        status: 'OVERDUE' as const,
      },
    ];

    const sorted = filterAndSortResidentReceipts(receipts, '', 'ALL', 'ALL', 'ACTION_REQUIRED', {
      rect_rejected: [
        {
          id: 'rpp_rejected',
          clientId: 'client_001',
          buildingId: 'b1',
          unitId: 'unit_1',
          receiptId: 'rect_rejected',
          uploadedByUserId: 'u_owner',
          fileName: 'rechazado.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          note: null,
          status: 'REJECTED',
          reviewedByUserId: 'u_admin',
          reviewedAt: '2026-05-04T10:00:00.000Z',
          reviewComment: 'No legible',
          deletedAt: null,
          createdAt: '2026-05-04T09:00:00.000Z',
          updatedAt: '2026-05-04T10:00:00.000Z',
          fileUrl: '/api/v1/finance/payment-proofs/rpp_rejected',
        },
      ],
      rect_review: [
        {
          id: 'rpp_review',
          clientId: 'client_001',
          buildingId: 'b1',
          unitId: 'unit_1',
          receiptId: 'rect_review',
          uploadedByUserId: 'u_owner',
          fileName: 'revision.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
          note: null,
          status: 'PENDING_REVIEW',
          reviewedByUserId: null,
          reviewedAt: null,
          reviewComment: null,
          deletedAt: null,
          createdAt: '2026-05-04T09:00:00.000Z',
          updatedAt: '2026-05-04T09:00:00.000Z',
          fileUrl: '/api/v1/finance/payment-proofs/rpp_review',
        },
      ],
    });

    expect(sorted.map((receipt) => receipt.id)).toEqual([
      'rect_pending_no_proof',
      'rect_rejected',
      'rect_review',
      'rect_overdue',
      'rect_paid_old',
    ]);
  });

});
