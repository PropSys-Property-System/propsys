import { EvidenceAttachment, User } from '@/lib/types';
import { MOCK_EVIDENCE_ATTACHMENTS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { unitsRepo } from '@/lib/repos/physical/units.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const evidenceRepo = {
  async listForUser(user: User): Promise<EvidenceAttachment[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ evidence: EvidenceAttachment[] }>('/api/v1/operation/evidence', { credentials: 'include' });
      return data.evidence;
    }
    await sleep(150);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_EVIDENCE_ATTACHMENTS
        : user.clientId
          ? MOCK_EVIDENCE_ATTACHMENTS.filter((x) => x.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      return tenantScoped.filter((x) => buildingIds.includes(x.buildingId));
    }

    const unitIds = (await unitsRepo.listForUser(user)).map((u) => u.id);
    if (unitIds.length === 0) return [];
    return tenantScoped.filter((x) => !x.unitId || unitIds.includes(x.unitId));
  },

  async listForChecklistExecution(user: User, checklistExecutionId: string): Promise<EvidenceAttachment[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ evidence: EvidenceAttachment[] }>(
        `/api/v1/operation/evidence?checklistExecutionId=${encodeURIComponent(checklistExecutionId)}`,
        { credentials: 'include' }
      );
      return data.evidence;
    }
    await sleep(100);
    return (await this.listForUser(user)).filter((x) => x.checklistExecutionId === checklistExecutionId);
  },

  async addForChecklistExecution(
    user: User,
    input: { checklistExecutionId: string; url: string; fileName?: string; mimeType?: string }
  ): Promise<EvidenceAttachment> {
    if (isDbMode()) {
      const res = await fetch('/api/v1/operation/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = (await res.json().catch(() => null)) as { evidence?: EvidenceAttachment; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      if (!data?.evidence) throw new Error('Respuesta inválida');
      return data.evidence;
    }
    await sleep(150);
    throw new Error('No disponible en mock');
  },

  async uploadForChecklistExecution(
    user: User,
    input: { checklistExecutionId: string; file: File }
  ): Promise<EvidenceAttachment> {
    if (isDbMode()) {
      const fd = new FormData();
      fd.set('checklistExecutionId', input.checklistExecutionId);
      fd.set('file', input.file);

      const res = await fetch('/api/v1/operation/evidence', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as { evidence?: EvidenceAttachment; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      if (!data?.evidence) throw new Error('Respuesta inválida');
      return data.evidence;
    }
    await sleep(150);

    const now = new Date().toISOString();
    const id = `ev_${Date.now()}`;
    const ev: EvidenceAttachment = {
      id,
      clientId: user.clientId ?? 'client_001',
      buildingId: 'b1',
      checklistExecutionId: input.checklistExecutionId,
      fileName: input.file.name,
      mimeType: input.file.type || 'application/octet-stream',
      sizeBytes: input.file.size,
      url: `/uploads/evidence/mock/${id}`,
      uploadedByUserId: user.id,
      createdAt: now,
    };
    MOCK_EVIDENCE_ATTACHMENTS.unshift(ev);
    return ev;
  },

  async deleteForUser(user: User, id: string): Promise<boolean> {
    if (isDbMode()) {
      const res = await fetch(`/api/v1/operation/evidence/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'No autorizado');
      return Boolean(data?.ok);
    }
    await sleep(100);

    const idx = MOCK_EVIDENCE_ATTACHMENTS.findIndex((x) => x.id === id);
    if (idx === -1) return false;
    const current = MOCK_EVIDENCE_ATTACHMENTS[idx];
    if (user.scope !== 'platform' && user.clientId && current.clientId !== user.clientId) return false;
    if (user.internalRole === 'STAFF' && current.uploadedByUserId !== user.id) throw new Error('No autorizado');
    MOCK_EVIDENCE_ATTACHMENTS.splice(idx, 1);
    return true;
  },
};

