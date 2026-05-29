import { describe, expect, it } from 'vitest';
import { Reservation } from '@/lib/types';
import {
  getStartOfWeek,
  getWeekDays,
  formatReservationTimeRange,
  isReservationInWeek,
  groupReservationsByDay,
} from './reservations-calendar.utils';

describe('reservations-calendar.utils', () => {
  it('getStartOfWeek returns Monday at 00:00:00', () => {
    // 2026-05-29 is a Friday
    const date = new Date('2026-05-29T12:00:00');
    const startOfWeek = getStartOfWeek(date);
    expect(startOfWeek.getDay()).toBe(1); // Monday
    expect(startOfWeek.getFullYear()).toBe(2026);
    expect(startOfWeek.getMonth()).toBe(4); // May
    expect(startOfWeek.getDate()).toBe(25); // Monday is 25th
    expect(startOfWeek.getHours()).toBe(0);
    expect(startOfWeek.getMinutes()).toBe(0);
  });

  it('getStartOfWeek works for Sundays', () => {
    // 2026-05-31 is Sunday
    const date = new Date('2026-05-31T12:00:00');
    const startOfWeek = getStartOfWeek(date);
    expect(startOfWeek.getDay()).toBe(1); // Monday
    expect(startOfWeek.getDate()).toBe(25); // Monday is still 25th
  });

  it('getWeekDays returns 7 consecutive days starting from given date', () => {
    const monday = new Date('2026-05-25T00:00:00');
    const days = getWeekDays(monday);
    expect(days).toHaveLength(7);
    expect(days[0].getDate()).toBe(25);
    expect(days[6].getDate()).toBe(31);
  });

  it('formatReservationTimeRange formats correctly', () => {
    const start = '2026-05-29T09:05:00';
    const end = '2026-05-29T14:30:00';
    expect(formatReservationTimeRange(start, end)).toBe('09:05 - 14:30');
  });

  it('isReservationInWeek checks overlap correctly', () => {
    const startOfWeek = new Date('2026-05-25T00:00:00'); // Mon May 25 to Sun May 31 23:59
    
    // Completely inside
    expect(
      isReservationInWeek(
        { startAt: '2026-05-29T10:00:00', endAt: '2026-05-29T12:00:00' } as Reservation,
        startOfWeek
      )
    ).toBe(true);

    // Outside (Before)
    expect(
      isReservationInWeek(
        { startAt: '2026-05-24T10:00:00', endAt: '2026-05-24T12:00:00' } as Reservation,
        startOfWeek
      )
    ).toBe(false);

    // Outside (After)
    expect(
      isReservationInWeek(
        { startAt: '2026-06-01T10:00:00', endAt: '2026-06-01T12:00:00' } as Reservation,
        startOfWeek
      )
    ).toBe(false);

    // Overlapping start boundary
    expect(
      isReservationInWeek(
        { startAt: '2026-05-24T23:00:00', endAt: '2026-05-25T01:00:00' } as Reservation,
        startOfWeek
      )
    ).toBe(true);
  });

  it('groupReservationsByDay groups correctly by startAt date', () => {
    const res1 = { id: '1', startAt: '2026-05-25T10:00:00' } as Reservation;
    const res2 = { id: '2', startAt: '2026-05-25T15:00:00' } as Reservation;
    const res3 = { id: '3', startAt: '2026-05-25T08:00:00' } as Reservation;
    const res4 = { id: '4', startAt: '2026-05-26T10:00:00' } as Reservation;

    const grouped = groupReservationsByDay([res1, res2, res3, res4]);
    
    expect(grouped.size).toBe(2);
    
    // Should be sorted by time
    const day1 = grouped.get('2026-05-25');
    expect(day1).toBeDefined();
    expect(day1!.map(r => r.id)).toEqual(['3', '1', '2']); // 08:00, 10:00, 15:00
    
    const day2 = grouped.get('2026-05-26');
    expect(day2).toBeDefined();
    expect(day2!.map(r => r.id)).toEqual(['4']);
  });
});
