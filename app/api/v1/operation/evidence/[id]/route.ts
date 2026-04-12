import { NextResponse } from 'next/server';
import path from 'node:path';
import { unlink } from 'node:fs/promises';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';

export const runtime = 'nodejs';

function isSafeUploadPath(storagePath: string) {
  const normalized = path.normalize(storagePath);
  const uploadsRoot = path.normalize(path.join(process.cwd(), 'public', 'uploads', 'evidence'));
  return normalized.startsWith(uploadsRoot);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'STAFF' && user.internalRole !== 'BUILDING_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (user.scope !== 'platform' && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id } = await ctx.params;
  const pool = getPool();
  const rowRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    checklist_execution_id: string | null;
    uploaded_by_user_id: string;
    storage_path: string | null;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, checklist_execution_id, uploaded_by_user_id, storage_path, deleted_at
     FROM evidence_attachments
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  const ev = rowRes.rows[0];
  if (!ev || ev.deleted_at) return NextResponse.json({ ok: false }, { status: 404 });
  if (user.scope !== 'platform' && ev.client_id !== user.clientId) return NextResponse.json({ ok: false }, { status: 404 });

  if (!ev.checklist_execution_id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const execRes = await pool.query<{ id: string; assigned_to_user_id: string; status: string; building_id: string }>(
    `SELECT id, assigned_to_user_id, status, building_id
     FROM checklist_executions
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [ev.checklist_execution_id]
  );
  const exec = execRes.rows[0];
  if (!exec) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (exec.status === 'APPROVED') return NextResponse.json({ error: 'No puedes eliminar evidencias de un checklist aprobado.' }, { status: 403 });

  if (user.internalRole === 'STAFF') {
    if (exec.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (ev.uploaded_by_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
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
  await pool.query(`UPDATE evidence_attachments SET deleted_at = $2 WHERE id = $1`, [id, now]);

  if (ev.storage_path && isSafeUploadPath(ev.storage_path)) {
    await unlink(ev.storage_path).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

