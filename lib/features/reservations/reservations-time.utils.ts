export function isReservationQuarterHour(value: string | Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getMinutes() % 15 === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}
