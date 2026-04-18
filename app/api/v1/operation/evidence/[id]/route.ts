import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';

export const runtime = 'nodejs';

type Queryable = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release?: () => void;
};

async function withWriteTransaction<T>(pool: ReturnType<typeof getPool>, fn: (db: Queryable) => Promise<T>) {
  const maybeConnect = (pool as ReturnType<typeof getPool> & { connect?: () => Promise<Queryable> }).connect;
  if (typeof maybeConnect !== 'function') {
    return fn(pool as unknown as Queryable);
  }

  const client = await maybeConnect.call(pool);
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => null);
    throw error;
  } finally {
    client.release?.();
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'STAFF' && user.internalRole !== 'BUILDING_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  if (!canBypassTenantScope(user) && !user.clientId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const pool = getPool();
  const rowRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    checklist_execution_id: string | null;
    uploaded_by_user_id: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, checklist_execution_id, uploaded_by_user_id, deleted_at
     FROM evidence_attachments
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const evidence = rowRes.rows[0];
  if (!evidence || evidence.deleted_at) return NextResponse.json({ ok: false }, { status: 404 });
  if (!canBypassTenantScope(user) && evidence.client_id !== user.clientId) {
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
  await withWriteTransaction(pool, async (db) => {
    await db.query(`UPDATE evidence_attachments SET deleted_at = $2 WHERE id = $1`, [id, now]);
    await db.query(
      `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, old_data)
       VALUES ($1, $2, $3, 'DELETE', 'EvidenceAttachment', $4, $5::jsonb, $6::jsonb)`,
      [
        `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
        evidence.client_id,
        user.id,
        evidence.id,
        JSON.stringify({
          buildingId: evidence.building_id,
          checklistExecutionId: evidence.checklist_execution_id,
        }),
        JSON.stringify(evidence),
      ]
    );
  });

  return NextResponse.json({ ok: true });
}
