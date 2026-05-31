import { describe, expect, it } from 'vitest';
import { buildReceiptsCsv } from './receipts-export';
import type { Receipt } from '@/lib/types';

const receipts: Receipt[] = [
  {
    id: 'rect_1',
    number: 'REC-000123',
    description: 'Mantenimiento "torre A"',
    amount: 250.5,
    currency: 'PEN',
    issueDate: '2026-05-01',
    dueDate: '2026-05-15',
    status: 'PENDING',
    buildingId: 'b1',
    unitId: 'u1',
  },
];

describe('buildReceiptsCsv', () => {
  it('prepends UTF-8 BOM and expected headers', () => {
    const csv = buildReceiptsCsv(receipts);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"numero";"descripcion";"monto";"moneda";"fecha_emision";"fecha_vencimiento";"estado";"edificio";"unidad"');
  });

  it('uses semicolon as separator and escapes quotes', () => {
    const csv = buildReceiptsCsv(receipts);

    expect(csv).toContain('"REC-000123";"Mantenimiento ""torre A""";"250.5";"PEN";"2026-05-01";"2026-05-15";"PENDING";"b1";"u1"');
    expect(csv).toContain('\r\n');
  });

  it('mitigates formula injection in free-text fields', () => {
    const csv = buildReceiptsCsv([
      {
        ...receipts[0],
        number: '=CMD()',
        description: '+SUM(A1:A2)',
        buildingId: '@building',
        unitId: '-101',
      },
    ]);

    expect(csv).toContain(`"'=CMD()"`);
    expect(csv).toContain(`"'+SUM(A1:A2)"`);
    expect(csv).toContain(`"'@building"`);
    expect(csv).toContain(`"'-101"`);
  });

  it('uses readable building and unit values when lookups are available', () => {
    const csv = buildReceiptsCsv(receipts, {
      buildingById: new Map([['b1', { id: 'b1', name: 'Torre Norte' }]]),
      unitById: new Map([['u1', { id: 'u1', number: '101' }]]),
    });

    expect(csv).toContain('"Torre Norte";"101"');
    expect(csv).not.toContain('"b1";"u1"');
  });

  it('keeps financial values unchanged in the export', () => {
    const csv = buildReceiptsCsv(receipts);

    expect(csv).toContain('"250.5"');
    expect(csv).toContain('"PENDING"');
    expect(csv).toContain('"PEN"');
  });
});
