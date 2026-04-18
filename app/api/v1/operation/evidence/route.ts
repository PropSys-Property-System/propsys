import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getPool } from '@/lib/server/db/client';
import { getSessionUser } from '@/lib/server/auth/get-session-user';
import { canBypassTenantScope } from '@/lib/server/auth/tenant-scope';
import type { EvidenceAttachment } from '@/lib/types';

export const runtime = 'nodejs';

type Queryable = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
  release?: () => void;
};

type EvidenceRow = {
  id: string;
  client_id: string;
  building_id: string;
  unit_id: string | null;
  incident_id: string | null;
  task_id: string | null;
  checklist_execution_id: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: string | number | null;
  storage_path: string | null;
  public_path: string | null;
  url: string;
  uploaded_by_user_id: string;
  created_at: string;
  deleted_at: string | null;
};

async function listBuildingIdsForUser(
  pool: ReturnType<typeof getPool>,
  user: { id: string; clientId: string | null; scope: string; internalRole: string }
) {
  if (canBypassTenantScope(user)) {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings');
    return all.rows.map((r) => r.id);
  }
  if (!user.clientId) return [];
  if (user.internalRole === 'ROOT_ADMIN' || user.internalRole === 'CLIENT_MANAGER') {
    const all = await pool.query<{ id: string }>('SELECT id FROM buildings WHERE client_id = $1', [user.clientId]);
    return all.rows.map((r) => r.id);
  }
  if (user.internalRole === 'BUILDING_ADMIN' || user.internalRole === 'STAFF') {
    const rows = await pool.query<{ building_id: string }>(
      `SELECT building_id
       FROM user_building_assignments
       WHERE user_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [user.id]
    );
    return rows.rows.map((r) => r.building_id);
  }
  return [];
}

function toEvidence(row: EvidenceRow): EvidenceAttachment {
  return {
    id: row.id,
    clientId: row.client_id,
    buildingId: row.building_id,
    unitId: row.unit_id ?? undefined,
    incidentId: row.incident_id ?? undefined,
    taskId: row.task_id ?? undefined,
    checklistExecutionId: row.checklist_execution_id ?? undefined,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    storagePath: row.storage_path ?? undefined,
    publicPath: row.public_path ?? undefined,
    url: row.url,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

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

function fileNameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last && last.length <= 200 ? last : 'evidence-link';
  } catch {
    return 'evidence-link';
  }
}

function isValidEvidenceUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function insertEvidenceAuditLog(
  db: Queryable,
  input: {
    clientId: string;
    userId: string;
    entity: EvidenceAttachment;
  }
) {
  await db.query(
    `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
     VALUES ($1, $2, $3, 'CREATE', 'EvidenceAttachment', $4, $5::jsonb, $6::jsonb)`,
    [
      `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
      input.clientId,
      input.userId,
      input.entity.id,
      JSON.stringify({
        buildingId: input.entity.buildingId,
        checklistExecutionId: input.entity.checklistExecutionId ?? null,
        taskId: input.entity.taskId ?? null,
        url: input.entity.url,
      }),
      JSON.stringify(input.entity),
    ]
  );
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole === 'OWNER' || user.internalRole === 'OCCUPANT') return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });

  const url = new URL(req.url);
  const checklistExecutionId = url.searchParams.get('checklistExecutionId');

  const pool = getPool();
  const tenantWhere = bypassTenant ? '' : 'AND client_id = $1';
  const tenantParams = bypassTenant ? [] : [user.clientId];

  if (checklistExecutionId) {
    const execRes = await pool.query<{ id: string; client_id: string; building_id: string; assigned_to_user_id: string }>(
      `SELECT id, client_id, building_id, assigned_to_user_id
       FROM checklist_executions
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [checklistExecutionId]
    );
    const exec = execRes.rows[0];
    if (!exec) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    if (!bypassTenant && (!user.clientId || exec.client_id !== user.clientId)) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });

    if (user.internalRole === 'STAFF' && exec.assigned_to_user_id !== user.id) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    if (user.internalRole === 'BUILDING_ADMIN') {
      const ok = await pool.query<{ ok: boolean }>(
        `SELECT true as ok
         FROM user_building_assignments
         WHERE user_id = $1 AND building_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
         LIMIT 1`,
        [user.id, exec.building_id]
      );
      if (!ok.rows[0]) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });
    }

    const rows = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      unit_id: string | null;
      incident_id: string | null;
      task_id: string | null;
      checklist_execution_id: string | null;
      file_name: string;
      mime_type: string;
      size_bytes: string | number | null;
      storage_path: string | null;
      public_path: string | null;
      url: string;
      uploaded_by_user_id: string;
      created_at: string;
      deleted_at: string | null;
    }>(
      `SELECT id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at
       FROM evidence_attachments
       WHERE deleted_at IS NULL
         ${tenantWhere}
         AND checklist_execution_id = $${tenantParams.length + 1}
       ORDER BY created_at DESC`,
      [...tenantParams, checklistExecutionId]
    );
    return NextResponse.json({ evidence: rows.rows.map(toEvidence) });
  }

  const buildingIds = await listBuildingIdsForUser(pool, user);
  if (buildingIds.length === 0) return NextResponse.json({ evidence: [] as EvidenceAttachment[] });

  const rows = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string | null;
    incident_id: string | null;
    task_id: string | null;
    checklist_execution_id: string | null;
    file_name: string;
    mime_type: string;
    size_bytes: string | number | null;
    storage_path: string | null;
    public_path: string | null;
    url: string;
    uploaded_by_user_id: string;
    created_at: string;
    deleted_at: string | null;
  }>(
    `SELECT id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at
     FROM evidence_attachments
     WHERE deleted_at IS NULL
       ${tenantWhere}
       AND building_id = ANY($${tenantParams.length + 1}::text[])
     ORDER BY created_at DESC`,
    [...tenantParams, buildingIds]
  );

  return NextResponse.json({ evidence: rows.rows.map(toEvidence) });
}

export async function POST(req: Request) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (user.internalRole !== 'STAFF' && user.internalRole !== 'BUILDING_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const bypassTenant = canBypassTenantScope(user);
  if (!bypassTenant && !user.clientId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'V1 solo admite evidencias como enlaces URL.' }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const checklistExecutionId =
    typeof body?.checklistExecutionId === 'string' ? body.checklistExecutionId.trim() : '';
  const evidenceUrl = typeof body?.url === 'string' ? body.url.trim() : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim() : '';

  const pool = getPool();
  const execId = checklistExecutionId;
  if (!execId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  if (!evidenceUrl || !isValidEvidenceUrl(evidenceUrl)) {
    return NextResponse.json({ error: 'Ingresa una URL valida para la evidencia.' }, { status: 400 });
  }

  if (!execId) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const execRes = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    task_id: string | null;
    assigned_to_user_id: string;
    status: string;
  }>(
    `SELECT id, client_id, building_id, task_id, assigned_to_user_id, status
     FROM checklist_executions
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [execId]
  );
  const exec = execRes.rows[0];
  if (!exec) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (!bypassTenant && (!user.clientId || exec.client_id !== user.clientId)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  if (exec.status === 'APPROVED') return NextResponse.json({ error: 'No puedes adjuntar evidencias a un checklist aprobado.' }, { status: 403 });

  if (user.internalRole === 'STAFF' && exec.assigned_to_user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
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

  const clientId = bypassTenant ? exec.client_id : user.clientId!;
  const now = new Date().toISOString();
  const id = `ev_${Date.now()}_${randomUUID().slice(0, 8)}`;

  /* Legacy upload flow removed. V1 supports URL evidence only.
  if (isMultipart) {
    const fileValue = multipartForm?.get('file') ?? null;
    const file = fileValue instanceof File ? fileValue : null;
    if (!file) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    if (file.size > MAX_EVIDENCE_BYTES) return NextResponse.json({ error: 'El archivo supera el límite de 10 MB.' }, { status: 400 });
    if (!isAllowedEvidence(file.name, file.type)) return NextResponse.json({ error: 'Tipo de archivo no permitido.' }, { status: 400 });

    const saved = await saveEvidenceFile({ checklistExecutionId: exec.id, file });

    const created = await pool.query<{
      id: string;
      client_id: string;
      building_id: string;
      unit_id: string | null;
      incident_id: string | null;
      task_id: string | null;
      checklist_execution_id: string | null;
      file_name: string;
      mime_type: string;
      size_bytes: string | number | null;
      storage_path: string | null;
      public_path: string | null;
      url: string;
      uploaded_by_user_id: string;
      created_at: string;
      deleted_at: string | null;
    }>(
      `INSERT INTO evidence_attachments (id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at)
       VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at`,
      [
        id,
        clientId,
        exec.building_id,
        exec.task_id,
        exec.id,
        saved.originalName,
        file.type || (saved.originalName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
        saved.sizeBytes,
        saved.storagePath,
        saved.publicPath,
        saved.publicPath,
        user.id,
        now,
      ]
    );

    const entity = toEvidence(created.rows[0]);
    await pool
      .query(
        `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
         VALUES ($1, $2, $3, 'CREATE', 'EvidenceAttachment', $4, $5::jsonb, $6::jsonb)`,
        [
          `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
          clientId,
          user.id,
          entity.id,
          JSON.stringify({ buildingId: entity.buildingId, checklistExecutionId: entity.checklistExecutionId ?? null, taskId: entity.taskId ?? null }),
          JSON.stringify(entity),
        ]
      )
      .catch(() => null);

    return NextResponse.json({ evidence: entity });
  }

  if (!url) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

  const created = await pool.query<{
    id: string;
    client_id: string;
    building_id: string;
    unit_id: string | null;
    incident_id: string | null;
    task_id: string | null;
    checklist_execution_id: string | null;
    file_name: string;
    mime_type: string;
    size_bytes: string | number | null;
    storage_path: string | null;
    public_path: string | null;
    url: string;
    uploaded_by_user_id: string;
    created_at: string;
    deleted_at: string | null;
  }>(
    `INSERT INTO evidence_attachments (id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, url, uploaded_by_user_id, created_at)
     VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at`,
    [
      id,
      clientId,
      exec.building_id,
      exec.task_id,
      exec.id,
      fileName || fileNameFromUrl(url),
      mimeType || 'text/uri-list',
      url,
      user.id,
      now,
    ]
  );

  const entity = toEvidence(created.rows[0]);
  await pool
    .query(
      `INSERT INTO audit_logs (id, client_id, user_id, action, entity, entity_id, metadata, new_data)
       VALUES ($1, $2, $3, 'CREATE', 'EvidenceAttachment', $4, $5::jsonb, $6::jsonb)`,
      [
        `audit_${Date.now()}_${randomUUID().slice(0, 8)}`,
        clientId,
        user.id,
        entity.id,
        JSON.stringify({ buildingId: entity.buildingId, checklistExecutionId: entity.checklistExecutionId ?? null, taskId: entity.taskId ?? null }),
        JSON.stringify(entity),
      ]
    )
    .catch(() => null);

  return NextResponse.json({ evidence: entity });
  */

  const evidence = await withWriteTransaction(pool, async (db) => {
    const created = await db.query<EvidenceRow>(
      `INSERT INTO evidence_attachments (id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, url, uploaded_by_user_id, created_at)
       VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, client_id, building_id, unit_id, incident_id, task_id, checklist_execution_id, file_name, mime_type, size_bytes, storage_path, public_path, url, uploaded_by_user_id, created_at, deleted_at`,
      [
        id,
        clientId,
        exec.building_id,
        exec.task_id,
        exec.id,
        fileName || fileNameFromUrl(evidenceUrl),
        mimeType || 'text/uri-list',
        evidenceUrl,
        user.id,
        now,
      ]
    );

    const entity = toEvidence(created.rows[0]);
    await insertEvidenceAuditLog(db, {
      clientId,
      userId: user.id,
      entity,
    });
    return entity;
  });

  return NextResponse.json({ evidence });
}
