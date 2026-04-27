import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canAccessTenantEntity, hasTenantClientContext } from '@/lib/server/auth/tenant-scope';
import { insertAuditLog } from '@/lib/server/audit/audit-log';
import { withTransaction } from '@/lib/server/db/tx';
import { deleteEvidenceFile } from '@/lib/server/operation/evidence-storage';

export const runtime = 'nodejs';

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'STAFF' && user.internalRole !== 'BUILDING_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!hasTenantClientContext(user)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const pool = getPool();
  const rowRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    checklist_execution_id: string | null;
    storage_path: string | null;
    uploaded_by_user_id: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, checklist_execution_id, storage_path, uploaded_by_user_id, deleted_at
     FROM evidence_attachments
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const evidence = rowRes.rows[0];
  if (!evidence || evidence.deleted_at) return NextResponse.json({ ok: false }, { status: 404 });
  if (!canAccessTenantEntity(user, evidence.client_id)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (!evidence.checklist_execution_id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const execRes = await pool.query<{ id: string; assigned_to_user_id: string; status: string; building_id: string }>(
    `SELECT id, assigned_to_user_id, status, building_id
     FROM checklist_executions
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [evidence.checklist_execution_id]
  );
  const exec = execRes.rows[0];
  if (!exec) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (exec.status === 'APPROVED') {
    return NextResponse.json({ error: 'No puedes eliminar evidencias de un checklist aprobado.' }, { status: 403 });
  }

  if (user.internalRole === 'STAFF') {
    if (exec.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (evidence.uploaded_by_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (user.internalRole === 'BUILDING_ADMIN') {
    const ok = await pool.query<{ ok: boolean }>(
      `SELECT true as ok
       FROM user_building_assignments
       WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
       LIMIT 1`,
      [user.id, exec.building_id]
    );
    if (!ok.rows[0]) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const now = new Date().toISOString();
  try {
    await withTransaction(pool, async (db) => {
      await db.query(`UPDATE evidence_attachments SET deleted_at = $2 WHERE id = $1`, [id, now]);
      await insertAuditLog(db, {
        clientId: evidence.client_id,
        userId: user.id,
        action: 'DELETE',
        entity: 'EvidenceAttachment',
        entityId: evidence.id,
        metadata: {
          buildingId: evidence.building_id,
          checklistExecutionId: evidence.checklist_execution_id,
        },
        oldData: evidence,
      });
    });
  } catch {
    return NextResponse.json({ error: 'No pudimos registrar la auditoría.' }, { status: 500 });
  }

  try {
    await deleteEvidenceFile(evidence.storage_path);
  } catch {}

  return NextResponse.json({ ok: true });
}
