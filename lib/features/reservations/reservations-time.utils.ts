export function isReservationQuarterHour(value: string | Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getMinutes() % 15 === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

export function buildReservationTimeOptions(): string[] {
  return Array.from({ length: 24 * 4 }, (_, index) => {
    const hour = Math.floor(index / 4);
    const minute = (index % 4) * 15;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });
}

export function buildReservationDateTime(date: string, time: string): string {
  return date && time ? `${date}T${time}` : '';
}
