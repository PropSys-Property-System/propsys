import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canAccessTenantEntity, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import {
  deletePaymentProofFile,
  isAllowedPaymentProof,
  MAX_PAYMENT_PROOF_BYTES,
  savePaymentProofFile,
} from '@/lib/server/finance/payment-proof-storage';

export const runtime = 'nodejs';

type SessionUser = {
  id: string;
  clientId: string | null;
  internalRole: string;
  scope: string;
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
};

function isUploadFile(value: FormDataEntryValue | null | undefined): value is File {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'name' in value &&
      'size' in value &&
      'type' in value &&
      'arrayBuffer' in value &&
      typeof value.arrayBuffer === 'function'
  );
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

async function getReceipt(pool: ReturnType<typeof getPool>, receiptId: string) {
  const res = await pool.query<ReceiptRow>(
    `SELECT id, client_id, building_id, unit_id, number, description, amount::text as amount, currency, issue_date::text as issue_date, due_date::text as due_date, status
     FROM receipts
     WHERE id = $1
     LIMIT 1`,
    [receiptId]
  );
  return res.rows[0] ?? null;
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

async function canViewReceipt(pool: ReturnType<typeof getPool>, user: SessionUser, receipt: ReceiptRow) {
  if (!canAccessTenantEntity(user, receipt.client_id)) return false;
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') return true;
  if (user.internalRole === 'BUILDING_ADMIN') {
    return hasBuildingAssignment(pool, user, receipt.building_id, receipt.client_id);
  }
  return hasUnitAssignment(pool, user, receipt.unit_id, receipt.client_id);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (
    user.internalRole !== 'ROOT_ADMIN' &&
    user.internalRole !== 'CLIENT_MANAGER' &&
    user.internalRole !== 'BUILDING_ADMIN' &&
    user.internalRole !== 'OWNER' &&
    user.internalRole !== 'OCCUPANT'
  ) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const pool = getPool();
  const receipt = await getReceipt(pool, id);
  if (!receipt) return NextResponse.json({ proofs: [] }, { status: 404 });
  if (!(await canViewReceipt(pool, user, receipt))) return NextResponse.json({ proofs: [] }, { status: 404 });

  const rows = await pool.query<PaymentProofRow>(
    `SELECT id, client_id, building_id, unit_id, receipt_id, uploaded_by_user_id, file_name, mime_type, size_bytes, storage_path, note, status, reviewed_by_user_id, reviewed_at, review_comment, deleted_at, created_at, updated_at
     FROM receipt_payment_proofs
     WHERE receipt_id = $1
       AND client_id = $2
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [receipt.id, receipt.client_id]
  );

  return NextResponse.json({ proofs: rows.rows.map(toProof) });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'OWNER' && user.internalRole !== 'OCCUPANT') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!hasTenantClientContext(user)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const formData = await req.formData().catch(() => null);
  const fileValue = formData ? formData.get('file') : null;
  const file = isUploadFile(fileValue) ? fileValue : null;
  const noteEntry = formData ? formData.get('note') : null;
  const note = typeof noteEntry === 'string' && noteEntry.trim() ? noteEntry.trim().slice(0, 1000) : null;

  if (!file) return NextResponse.json({ error: 'Adjunta una imagen o PDF del comprobante.' }, { status: 400 });
  if (file.size > MAX_PAYMENT_PROOF_BYTES) return NextResponse.json({ error: 'El archivo supera el limite de 10 MB.' }, { status: 400 });
  if (!isAllowedPaymentProof(file.name, file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Solo imagenes o PDF.' }, { status: 400 });
  }

  const pool = getPool();
  const receipt = await getReceipt(pool, id);
  if (!receipt) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  if (!canAccessTenantEntity(user, receipt.client_id)) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });

  const unitOk = await hasUnitAssignment(pool, user, receipt.unit_id, receipt.client_id);
  if (!unitOk) return NextResponse.json({ error: 'Recibo no encontrado' }, { status: 404 });
  if (receipt.status !== 'PENDING') {
    return NextResponse.json({ error: 'Solo se pueden subir comprobantes para recibos pendientes.' }, { status: 400 });
  }

  const proofId = `rpp_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  let savedFile: Awaited<ReturnType<typeof savePaymentProofFile>> | null = null;

  try {
    savedFile = await savePaymentProofFile({ receiptId: receipt.id, proofId, file });
    const storedFile = savedFile;

    const proof = await withTransaction(pool, async (db) => {
      const created = await db.query<PaymentProofRow>(
        `INSERT INTO receipt_payment_proofs (id, client_id, building_id, unit_id, receipt_id, uploaded_by_user_id, file_name, mime_type, size_bytes, storage_path, note, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING_REVIEW', $12, $12)
         RETURNING id, client_id, building_id, unit_id, receipt_id, uploaded_by_user_id, file_name, mime_type, size_bytes, storage_path, note, status, reviewed_by_user_id, reviewed_at, review_comment, deleted_at, created_at, updated_at`,
        [
          proofId,
          receipt.client_id,
          receipt.building_id,
          receipt.unit_id,
          receipt.id,
          user.id,
          storedFile.originalName,
          storedFile.mimeType,
          storedFile.sizeBytes,
          storedFile.storagePath,
          note,
          now,
        ]
      );

      const entity = toProof(created.rows[0]);
      await insertAuditLog(db, {
        clientId: receipt.client_id,
        userId: user.id,
        action: 'CREATE',
        entity: 'ReceiptPaymentProof',
        entityId: proofId,
        metadata: {
          buildingId: receipt.building_id,
          unitId: receipt.unit_id,
          receiptId: receipt.id,
          mimeType: storedFile.mimeType,
        },
        newData: entity,
      });
      return entity;
    });

    return NextResponse.json({ proof });
  } catch (error) {
    try {
      await deletePaymentProofFile(savedFile?.storagePath);
    } catch {}
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ya existe un comprobante pendiente o aprobado para este recibo.' }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : 'No pudimos guardar el comprobante.';
    return NextResponse.json({ error: message || 'No pudimos guardar el comprobante.' }, { status: 500 });
  }
}
