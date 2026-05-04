import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canAccessTenantEntity, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import { readPaymentProofFile } from '@/lib/server/finance/payment-proof-storage';

export const runtime = 'nodejs';

type SessionUser = {
  id: string;
  clientId: string | null;
  internalRole: string;
  scope: string;
};

type PaymentProofRow = {
  id: string;
  client_id: string;
  building_id: string;
  unit_id: string;
  receipt_id: string;
  uploaded_by_user_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: string | number;
  storage_path: string;
  note: string | null;
  status: string;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  receipt_status: string;
};

type ReceiptRow = {
  id: string;
  client_id: string;
  building_id: string;
  unit_id: string;
  number: string;
  description: string | null;
  amount: string;
  currency: string;
  issue_date: string;
  due_date: string;
  status: string;
};

function contentDisposition(fileName: string) {
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '').replace(/["\\\r\n]/g, '').trim() || 'payment-proof';
  return `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function toProof(row: PaymentProofRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    receiptId: row.receipt_id,
    uploadedByUserId: row.uploaded_by_user_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    note: row.note,
    status: row.status,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewComment: row.review_comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    fileUrl: `/api/v1/finance/payment-proofs/${encodeURIComponent(row.id)}`,
  };
}

function toReceipt(row: ReceiptRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id,
    number: row.number,
    description: row.description ?? '',
    amount: Number(row.amount),
    currency: row.currency,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
  };
}

async function getProof(pool: ReturnType<typeof getPool>, id: string) {
  const res = await pool.query<PaymentProofRow>(
    `SELECT rpp.id, rpp.client_id, rpp.building_id, rpp.unit_id, rpp.receipt_id, rpp.uploaded_by_user_id, rpp.file_name, rpp.mime_type, rpp.size_bytes, rpp.storage_path, rpp.note, rpp.status, rpp.reviewed_by_user_id, rpp.reviewed_at, rpp.review_comment, rpp.deleted_at, rpp.created_at, rpp.updated_at, r.status as receipt_status
     FROM receipt_payment_proofs rpp
     JOIN receipts r ON r.id = rpp.receipt_id AND r.client_id = rpp.client_id
     WHERE rpp.id = $1
       AND rpp.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return res.rows[0] ?? null;
}

async function hasBuildingAssignment(pool: ReturnType<typeof getPool>, user: SessionUser, buildingId: string, clientId: string) {
  const ok = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_building_assignments
     WHERE user_id = $1 AND building_id = $2 AND client_id = $3 AND status = 'ACTIVE' AND deleted_at IS NULL
     LIMIT 1`,
    [user.id, buildingId, clientId]
  );
  return !!ok.rows[0];
}

async function hasUnitAssignment(pool: ReturnType<typeof getPool>, user: SessionUser, unitId: string, clientId: string) {
  if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') return false;
  const ok = await pool.query<{ ok: boolean }>(
    `SELECT true as ok
     FROM user_unit_assignments
     WHERE user_id = $1
       AND unit_id = $2
       AND assignment_type = $3
       AND status = 'ACTIVE'
       AND deleted_at IS NULL
       AND client_id = $4
     LIMIT 1`,
    [user.id, unitId, user.internalRole === 'OWNER' ? 'OWNER' : 'OCCUPANT', clientId]
  );
  return !!ok.rows[0];
}

async function canAccessProof(pool: ReturnType<typeof getPool>, user: SessionUser, proof: PaymentProofRow, residentAllowed: boolean) {
  if (!canAccessTenantEntity(user, proof.client_id)) return false;
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') return true;
  if (user.internalRole === 'BUILDING_ADMIN') return hasBuildingAssignment(pool, user, proof.building_id, proof.client_id);
  if (residentAllowed && (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT')) {
    return hasUnitAssignment(pool, user, proof.unit_id, proof.client_id);
  }
  return false;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const pool = getPool();
  const proof = await getProof(pool, id);
  if (!proof) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!(await canAccessProof(pool, user, proof, true))) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const file = await readPaymentProofFile(proof.storage_path).catch(() => null);
  if (!file) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return new NextResponse(file, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': contentDisposition(proof.file_name),
      'Content-Length': String(file.byteLength),
      'Content-Type': proof.mime_type,
    },
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'BUILDING_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const action = body?.action === 'APPROVE' || body?.action === 'REJECT' ? body.action : null;
  const reviewComment = typeof body?.reviewComment === 'string' && body.reviewComment.trim() ? body.reviewComment.trim().slice(0, 1000) : null;
  if (!action) return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 });

  const { id } = await ctx.params;
  const pool = getPool();
  const proof = await getProof(pool, id);
  if (!proof) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!(await canAccessProof(pool, user, proof, false))) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }
  if (proof.status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'El comprobante ya fue revisado.' }, { status: 400 });
  }
  if (action === 'APPROVE' && proof.receipt_status !== 'PENDING') {
    return NextResponse.json({ error: 'Solo se pueden aprobar comprobantes de recibos pendientes.' }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    const result = await withTransaction(pool, async (db) => {
      const proofRes = await db.query<PaymentProofRow>(
        `UPDATE receipt_payment_proofs
         SET status = $2, reviewed_by_user_id = $3, reviewed_at = $4, review_comment = $5, updated_at = $4
         WHERE id = $1 AND status = 'PENDING_REVIEW'
         RETURNING id, client_id, building_id, unit_id, receipt_id, uploaded_by_user_id, file_name, mime_type, size_bytes, storage_path, note, status, reviewed_by_user_id, reviewed_at, review_comment, deleted_at, created_at, updated_at, $6::text as receipt_status`,
        [id, action === 'APPROVE' ? 'APPROVED' : 'REJECTED', user.id, now, reviewComment, action === 'APPROVE' ? 'PAID' : proof.receipt_status]
      );
      const updatedProof = proofRes.rows[0];
      if (!updatedProof) throw new Error('El comprobante ya fue revisado.');

      await insertAuditLog(db, {
        clientId: proof.client_id,
        userId: user.id,
        action: action === 'APPROVE' ? 'APPROVE' : 'REJECT',
        entity: 'ReceiptPaymentProof',
        entityId: proof.id,
        metadata: {
          buildingId: proof.building_id,
          unitId: proof.unit_id,
          receiptId: proof.receipt_id,
          reviewComment,
        },
        oldData: toProof(proof),
        newData: toProof(updatedProof),
      });

      if (action === 'REJECT') {
        return { proof: toProof(updatedProof), receipt: { id: proof.receipt_id, status: proof.receipt_status } };
      }

      const receiptRes = await db.query<ReceiptRow>(
        `UPDATE receipts
         SET status = 'PAID', updated_at = $2
         WHERE id = $1 AND status = 'PENDING'
         RETURNING id, client_id, building_id, unit_id, number, description, amount::text as amount, currency, issue_date::text as issue_date, due_date::text as due_date, status`,
        [proof.receipt_id, now]
      );
      const updatedReceipt = receiptRes.rows[0];
      if (!updatedReceipt) throw new Error('Solo se pueden aprobar comprobantes de recibos pendientes.');

      await insertAuditLog(db, {
        clientId: proof.client_id,
        userId: user.id,
        action: 'MARK_PAID',
        entity: 'Receipt',
        entityId: proof.receipt_id,
        metadata: { source: 'PAYMENT_PROOF_REVIEW', proofId: proof.id },
        newData: toReceipt(updatedReceipt),
      });

      return { proof: toProof(updatedProof), receipt: toReceipt(updatedReceipt) };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No pudimos revisar el comprobante.';
    return NextResponse.json({ error: message || 'No pudimos revisar el comprobante.' }, { status: 500 });
  }
}
