import { Reservation } from '@/lib/types';

/**
 * Devuelve el lunes de la semana de la fecha dada (lunes a domingo).
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Devuelve un array con las 7 fechas (objetos Date) de una semana comenzando desde startDate.
 */
export function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

/**
 * Formatea un rango horario "HH:MM - HH:MM" a partir de dos ISO strings.
 */
export function formatReservationTimeRange(startAt: string, endAt: string): string {
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return `${formatTime(startAt)} - ${formatTime(endAt)}`;
}

/**
 * Verifica si una reserva cae dentro del rango de startOfWeek y endOfWeek.
 * endOfWeek debe ser exclusivo (lunes de la siguiente semana a las 00:00:00).
 */
export function isReservationInWeek(reservation: Reservation, startOfWeek: Date): boolean {
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const start = new Date(reservation.startAt);
  const end = new Date(reservation.endAt);

  // Solapamiento simple: startA < endB && startB < endA
  return start < endOfWeek && startOfWeek < end;
}

/**
 * Agrupa las reservas por la fecha YYYY-MM-DD en la que inician (para V1 asumimos reservas no cruzan días).
 */
export function groupReservationsByDay(reservations: Reservation[]): Map<string, Reservation[]> {
  const map = new Map<string, Reservation[]>();

  for (const r of reservations) {
    const d = new Date(r.startAt);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    const existing = map.get(dateKey) || [];
    existing.push(r);
    map.set(dateKey, existing);
  }

  // Ordenar dentro de cada día por hora de inicio
  for (const [key, list] of map.entries()) {
    list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    map.set(key, list);
  }

  return map;
}
