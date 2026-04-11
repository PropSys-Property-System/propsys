import { ChecklistTemplate, User } from '@/lib/types';
import { MOCK_CHECKLIST_TEMPLATES } from '@/lib/mocks';
import { accessScope } from '@/lib/access/access-scope';
import { buildingsRepo } from '@/lib/repos/physical/buildings.repo';
import { isDbMode } from '@/lib/config/data-mode';
import { fetchJsonOrThrow } from '@/lib/repos/http';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const checklistTemplatesRepo = {
  async listForUser(user: User): Promise<ChecklistTemplate[]> {
    if (isDbMode()) {
      const data = await fetchJsonOrThrow<{ templates: ChecklistTemplate[] }>('/api/v1/operation/checklist-templates', {
        credentials: 'include',
      });
      return data.templates;
    }
    await sleep(200);

    const tenantScoped =
      user.scope === 'platform'
        ? MOCK_CHECKLIST_TEMPLATES
        : user.clientId
          ? MOCK_CHECKLIST_TEMPLATES.filter((t) => t.clientId === user.clientId)
          : [];

    if (accessScope(user) === 'PORTFOLIO') return tenantScoped;

    if (accessScope(user) === 'BUILDING') {
      const buildingIds = (await buildingsRepo.listForUser(user)).map((b) => b.id);
      if (buildingIds.length === 0) return [];
      return tenantScoped.filter((t) => buildingIds.includes(t.buildingId));
    }

    return [];
  },
};

