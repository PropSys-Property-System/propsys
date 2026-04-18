import type { Receipt } from '@/lib/types';

const RECEIPT_LOCALE = 'es-PE';

function isValidDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

export function formatReceiptDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  if (!isValidDate(value)) return 'Fecha invalida';
  return new Date(value).toLocaleDateString(RECEIPT_LOCALE, options);
}

export function formatReceiptAmount(amount: number, currency: string): string {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '---';

  try {
    return new Intl.NumberFormat(RECEIPT_LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(RECEIPT_LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
}

export function summarizeReceiptTotalsByCurrency(
  receipts: Array<Pick<Receipt, 'amount' | 'currency'>>
): string[] {
  const totals = new Map<string, number>();

  for (const receipt of receipts) {
    const previous = totals.get(receipt.currency) ?? 0;
    totals.set(receipt.currency, previous + receipt.amount);
  }

  return [...totals.entries()].map(([currency, amount]) => formatReceiptAmount(amount, currency));
}

