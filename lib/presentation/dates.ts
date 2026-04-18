const PRESENTATION_LOCALE = 'es-PE';

function toDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(
  value: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = toDate(value);
  if (!parsed) return 'Fecha invalida';
  return parsed.toLocaleString(PRESENTATION_LOCALE, options);
}

export function formatTime(
  value: string,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
): string {
  const parsed = toDate(value);
  if (!parsed) return '--:--';
  return parsed.toLocaleTimeString(PRESENTATION_LOCALE, options);
}
