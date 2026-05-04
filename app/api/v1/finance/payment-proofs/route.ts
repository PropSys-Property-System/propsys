import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';

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

const ALLOWED_STATUSES = new Set(['PENDING_REVIEW', 'APPROVED', 'REJECTED']);

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

async function listBuildingIdsForUser(
  pool: ReturnType<typeof getPool>,
  user: { id: string; clientId: string | null; scope: string; internalRole: string }
) {
  if (canBypassTenantScope(user)) {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings');
    return all.rows.map((row) => row.id);
  }
  if (!user.clientId) return [];
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings WHERE client_id = $1', [user.clientId]);
    return all.rows.map((row) => row.id);
  }
  if (user.internalRole === 'BUILDING_ADMIN') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT building_id
       FROM user_building_assignments
       WHERE user_id = $1 AND client_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [user.id, user.clientId]
    );
    return rows.rows.map((row) => row.building_id);
  }
  return [];
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER' && user.internalRole !== 'BUILDING_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!hasTenantClientContext(user)) return NextResponse.json({ proofs: [] });

  const url = new URL(req.url);
  const requestedStatus = url.searchParams.get('status') ?? 'PENDING_REVIEW';
  if (!ALLOWED_STATUSES.has(requestedStatus)) {
    return NextResponse.json({ error: 'Estado invalido' }, { status: 400 });
  }

  const pool = getPool();
  const bypassTenant = canBypassTenantScope(user);
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];
  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ proofs: [] });

  const statusParamIndex = tenantParams.length + 2;
  const rows = await pool.query<PaymentProofRow>(
    `SELECT id, client_id, building_id, unit_id, receipt_id, uploaded_by_user_id, file_name, mime_type, size_bytes, storage_path, note, status, reviewed_by_user_id, reviewed_at, review_comment, deleted_at, created_at, updated_at
     FROM receipt_payment_proofs
     WHERE deleted_at IS NULL
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
       AND status = $${statusParamIndex}
     ORDER BY created_at DESC`,
    [...tenantParams, buildingIds, requestedStatus]
  );

  return NextResponse.json({ proofs: rows.rows.map(toProof) });
}
