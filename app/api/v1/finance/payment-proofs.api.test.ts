import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as listAdminProofs } from './payment-proofs/route';
import { GET as streamProof, PATCH as reviewProof } from './payment-proofs/[id]/route';
import { GET as listReceiptProofs, POST as uploadProof } from './receipts/[id]/payment-proofs/route';

const poolQuery = vi.fn();
const clientQuery = vi.fn();
const release = vi.fn();
const connect = vi.fn(async () => ({ query: clientQuery, release }));

const storageMocks = vi.hoisted(() => ({
  savePaymentProofFile: vi.fn(),
  readPaymentProofFile: vi.fn(),
  deletePaymentProofFile: vi.fn(),
  isAllowedPaymentProof: vi.fn(() => true),
}));

vi.mock('@/lib/server/db/client', () => ({
  getPool: () => ({
    query: poolQuery,
    connect,
  }),
}));

vi.mock('@/lib/server/finance/payment-proof-storage', () => ({
  MAX_PAYMENT_PROOF_BYTES: 10 * 1024 * 1024,
  savePaymentProofFile: storageMocks.savePaymentProofFile,
  readPaymentProofFile: storageMocks.readPaymentProofFile,
  deletePaymentProofFile: storageMocks.deletePaymentProofFile,
  isAllowedPaymentProof: storageMocks.isAllowedPaymentProof,
}));

const sessionUser = {
  id: 'u_owner',
  clientId: 'client_001' as string | null,
  email: 'owner@propsys.com',
  name: 'Owner',
  role: 'OWNER',
  internalRole: 'OWNER' as string,
  scope: 'client' as string,
  status: 'ACTIVE',
};

vi.mock('@/lib/server/auth/get-session-user', () => ({
  getSessionUser: vi.fn(async () => sessionUser),
}));

function receiptRow(overrides: Partial<{ client_id: string; status: string; unit_id: string; building_id: string }> = {}) {
  return {
    id: 'rect_1',
    client_id: 'client_001',
    building_id: 'b1',
    unit_id: 'unit_1',
    number: 'REC-001',
    description: 'Recibo de prueba',
    amount: '150.00',
    currency: 'PEN',
    issue_date: '2026-04-01',
    due_date: '2026-04-10',
    status: 'PENDING',
    ...overrides,
  };
}

function proofRow(
  overrides: Partial<{
    status: string;
    client_id: string;
    building_id: string;
    unit_id: string;
    receipt_id: string;
    reviewed_by_user_id: string | null;
    reviewed_at: string | null;
    review_comment: string | null;
    receipt_status: string;
  }> = {}
) {
  return {
    id: 'rpp_1',
    client_id: 'client_001',
    building_id: 'b1',
    unit_id: 'unit_1',
    receipt_id: 'rect_1',
    uploaded_by_user_id: 'u_owner',
    file_name: 'comprobante.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 4,
    storage_path: '.data/uploads/finance/payment-proofs/rect_1/rpp_1.jpg',
    note: 'Pago por transferencia',
    status: 'PENDING_REVIEW',
    reviewed_by_user_id: null,
    reviewed_at: null,
    review_comment: null,
    deleted_at: null,
    created_at: '2026-05-04T10:00:00.000Z',
    updated_at: '2026-05-04T10:00:00.000Z',
    receipt_status: 'PENDING',
    ...overrides,
  };
}

function formRequest() {
  const formData = new FormData();
  formData.set('file', new File([new Uint8Array([1, 2, 3, 4])], 'comprobante.jpg', { type: 'image/jpeg' }));
  formData.set('note', 'Pago por transferencia');
  const req = new Request('http://localhost/api/v1/finance/receipts/rect_1/payment-proofs', {
    method: 'POST',
    body: formData,
  });
  Object.defineProperty(req, 'formData', { value: async () => formData });
  return req;
}

describe('finance payment proofs API', () => {
  beforeEach(() => {
    poolQuery.mockReset();
    clientQuery.mockReset();
    release.mockReset();
    connect.mockClear();
    storageMocks.savePaymentProofFile.mockReset();
    storageMocks.readPaymentProofFile.mockReset();
    storageMocks.deletePaymentProofFile.mockReset();
    storageMocks.isAllowedPaymentProof.mockReset();
    storageMocks.isAllowedPaymentProof.mockReturnValue(true);
    sessionUser.id = 'u_owner';
    sessionUser.clientId = 'client_001';
    sessionUser.role = 'OWNER';
    sessionUser.internalRole = 'OWNER';
    sessionUser.scope = 'client';
  });

  it('lets an assigned owner upload a pending payment proof without exposing storagePath', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) return { rows: [receiptRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });
    storageMocks.savePaymentProofFile.mockResolvedValue({
      originalName: 'comprobante.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      storagePath: '.data/uploads/finance/payment-proofs/rect_1/rpp_1.jpg',
      publicPath: '/api/v1/finance/payment-proofs/rpp_1',
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('INSERT INTO receipt_payment_proofs')) return { rows: [proofRow()] };
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const res = await uploadProof(formRequest(), { params: Promise.resolve({ id: 'rect_1' }) });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { proof: Record<string, unknown> };
    expect(data.proof.status).toBe('PENDING_REVIEW');
    expect(data.proof.fileUrl).toBe('/api/v1/finance/payment-proofs/rpp_1');
    expect(data.proof).not.toHaveProperty('storagePath');
    expect(storageMocks.savePaymentProofFile).toHaveBeenCalledTimes(1);
    expect(clientQuery.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO audit_logs'))).toBe(true);
  });

  it('rejects upload for a receipt outside the resident unit scope before saving the file', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) return { rows: [receiptRow({ unit_id: 'unit_other' })] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [] };
      return { rows: [] };
    });

    const res = await uploadProof(formRequest(), { params: Promise.resolve({ id: 'rect_1' }) });

    expect(res.status).toBe(404);
    expect(storageMocks.savePaymentProofFile).not.toHaveBeenCalled();
  });

  it('rejects upload when the receipt is not pending', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) return { rows: [receiptRow({ status: 'PAID' })] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });

    const res = await uploadProof(formRequest(), { params: Promise.resolve({ id: 'rect_1' }) });

    expect(res.status).toBe(400);
    expect(storageMocks.savePaymentProofFile).not.toHaveBeenCalled();
  });

  it('returns 409 and cleans up the saved file when an active proof already exists', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) return { rows: [receiptRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });
    storageMocks.savePaymentProofFile.mockResolvedValue({
      originalName: 'comprobante.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      storagePath: '.data/uploads/finance/payment-proofs/rect_1/rpp_1.jpg',
      publicPath: '/api/v1/finance/payment-proofs/rpp_1',
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('INSERT INTO receipt_payment_proofs')) {
        throw Object.assign(new Error('duplicate'), { code: '23505' });
      }
      return { rows: [] };
    });

    const res = await uploadProof(formRequest(), { params: Promise.resolve({ id: 'rect_1' }) });

    expect(res.status).toBe(409);
    expect(storageMocks.deletePaymentProofFile).toHaveBeenCalledWith('.data/uploads/finance/payment-proofs/rect_1/rpp_1.jpg');
  });

  it('lets an owner list proofs for their own receipt without exposing storagePath', async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipts')) return { rows: [receiptRow()] };
      if (sql.includes('FROM user_unit_assignments')) return { rows: [{ ok: true }] };
      if (sql.includes('FROM receipt_payment_proofs')) return { rows: [proofRow()] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/receipts/rect_1/payment-proofs', { method: 'GET' });
    const res = await listReceiptProofs(req, { params: Promise.resolve({ id: 'rect_1' }) });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { proofs: Array<Record<string, unknown>> };
    expect(data.proofs).toHaveLength(1);
    expect(data.proofs[0].fileUrl).toBe('/api/v1/finance/payment-proofs/rpp_1');
    expect(data.proofs[0]).not.toHaveProperty('storagePath');
  });

  it('lists pending payment proofs for an assigned building admin scope', async () => {
    sessionUser.id = 'u_admin';
    sessionUser.role = 'MANAGER';
    sessionUser.internalRole = 'BUILDING_ADMIN';
    let proofSql = '';

    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ building_id: 'b1' }] };
      if (sql.includes('FROM receipt_payment_proofs')) {
        proofSql = sql;
        return { rows: [proofRow()] };
      }
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/payment-proofs?status=PENDING_REVIEW', { method: 'GET' });
    const res = await listAdminProofs(req);

    expect(res.status).toBe(200);
    const data = (await res.json()) as { proofs: Array<{ id: string }> };
    expect(data.proofs.map((proof) => proof.id)).toEqual(['rpp_1']);
    expect(proofSql).toContain('building_id = ANY');
  });

  it('does not read the proof file when a building admin is outside scope', async () => {
    sessionUser.id = 'u_admin';
    sessionUser.role = 'MANAGER';
    sessionUser.internalRole = 'BUILDING_ADMIN';
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipt_payment_proofs')) return { rows: [proofRow()] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/payment-proofs/rpp_1', { method: 'GET' });
    const res = await streamProof(req, { params: Promise.resolve({ id: 'rpp_1' }) });

    expect(res.status).toBe(404);
    expect(storageMocks.readPaymentProofFile).not.toHaveBeenCalled();
  });

  it('approves a pending proof and marks the receipt paid in one audited transaction', async () => {
    sessionUser.id = 'u_admin';
    sessionUser.role = 'MANAGER';
    sessionUser.internalRole = 'BUILDING_ADMIN';
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipt_payment_proofs')) return { rows: [proofRow()] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE receipt_payment_proofs')) {
        return { rows: [proofRow({ status: 'APPROVED', reviewed_by_user_id: 'u_admin', reviewed_at: '2026-05-04T10:05:00.000Z' })] };
      }
      if (sql.includes('UPDATE receipts')) return { rows: [receiptRow({ status: 'PAID' })] };
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/payment-proofs/rpp_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'APPROVE', reviewComment: 'Validado' }),
    });
    const res = await reviewProof(req, { params: Promise.resolve({ id: 'rpp_1' }) });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { proof: { status: string }; receipt: { status: string } };
    expect(data.proof.status).toBe('APPROVED');
    expect(data.receipt.status).toBe('PAID');
    expect(clientQuery.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO audit_logs'))).toHaveLength(2);
  });

  it('rejects a pending proof without marking the receipt paid', async () => {
    sessionUser.id = 'u_admin';
    sessionUser.role = 'MANAGER';
    sessionUser.internalRole = 'BUILDING_ADMIN';
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM receipt_payment_proofs')) return { rows: [proofRow()] };
      if (sql.includes('FROM user_building_assignments')) return { rows: [{ ok: true }] };
      return { rows: [] };
    });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('UPDATE receipt_payment_proofs')) {
        return { rows: [proofRow({ status: 'REJECTED', reviewed_by_user_id: 'u_admin', reviewed_at: '2026-05-04T10:05:00.000Z' })] };
      }
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [] };
      return { rows: [] };
    });

    const req = new Request('http://localhost/api/v1/finance/payment-proofs/rpp_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'REJECT', reviewComment: 'No legible' }),
    });
    const res = await reviewProof(req, { params: Promise.resolve({ id: 'rpp_1' }) });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { proof: { status: string }; receipt: { status: string } };
    expect(data.proof.status).toBe('REJECTED');
    expect(data.receipt.status).toBe('PENDING');
    expect(clientQuery.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE receipts'))).toBe(false);
  });
});
