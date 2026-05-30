import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = join(process.cwd(), 'app', 'api', 'v1');

function listRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listRouteFiles(fullPath);
    return entry.name === 'route.ts' ? [fullPath] : [];
  });
}

describe('user_building_assignments tenant hardening', () => {
  it('keeps every API read explicitly scoped by client_id', () => {
    const missingClientScope: string[] = [];

    for (const file of listRouteFiles(apiRoot)) {
      const source = readFileSync(file, 'utf8');
      const assignmentReads = source.match(/`[^`]*(?:FROM|JOIN) user_building_assignments[^`]*`/g) ?? [];

      assignmentReads.forEach((query, index) => {
        if (!query.includes('client_id')) {
          missingClientScope.push(`${relative(process.cwd(), file)}#${index + 1}`);
        }
      });
    }

    expect(missingClientScope).toEqual([]);
  });
});
