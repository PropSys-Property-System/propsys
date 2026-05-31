import type { Receipt } from '@/lib/types';

type ReceiptBuildingLookup = {
  id: string;
  name: string;
};

type ReceiptUnitLookup = {
  id: string;
  number: string;
};

type BuildReceiptsCsvOptions = {
  buildingById?: Map<string, ReceiptBuildingLookup>;
  unitById?: Map<string, ReceiptUnitLookup>;
};

const CSV_BOM = '\uFEFF';
const CSV_SEPARATOR = ';';
const CSV_HEADERS = [
  'numero',
  'descripcion',
  'monto',
  'moneda',
  'fecha_emision',
  'fecha_vencimiento',
  'estado',
  'edificio',
  'unidad',
] as const;

function sanitizeCsvValue(value: string) {
  const normalized = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
}

function escapeCsvCell(value: string) {
  return `"${sanitizeCsvValue(value).replaceAll('"', '""')}"`;
}

export function buildReceiptsCsv(
  receipts: Receipt[],
  { buildingById = new Map(), unitById = new Map() }: BuildReceiptsCsvOptions = {}
) {
  const rows = receipts.map((receipt) => {
    const buildingName = buildingById.get(receipt.buildingId)?.name ?? receipt.buildingId;
    const unitNumber = unitById.get(receipt.unitId)?.number ?? receipt.unitId;

    return [
      receipt.number,
      receipt.description,
      String(receipt.amount),
      receipt.currency,
      receipt.issueDate,
      receipt.dueDate,
      receipt.status,
      buildingName,
      unitNumber,
    ];
  });

  const content = [CSV_HEADERS, ...rows]
    .map((row) => row.map((value) => escapeCsvCell(String(value))).join(CSV_SEPARATOR))
    .join('\r\n');

  return `${CSV_BOM}${content}`;
}
