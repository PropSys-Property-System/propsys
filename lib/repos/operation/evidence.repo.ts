import { EvidenceAttachment, User } from '@/lib/types';
import { MOCK_EVIDENCE_ATTACHMENTS } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const evidenceRepo = {
  async listForUser(user: User): Promise<EvidenceAttachment[]> {
    await sleep(150);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_EVIDENCE_ATTACHMENTS
        : user.clientId
          ? MOCK_EVIDENCE_ATTACHMENTS.filter((x) => x.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      if (!user.buildingId) return [];
      return tenantScoped.filter((x) => x.buildingId === user.buildingId);
    }

    if (user.unitId) return tenantScoped.filter((x) => !x.unitId || x.unitId === user.unitId);
    return [];
  },
};
