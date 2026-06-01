import { describe, expect, it } from 'vitest';
import { isReservationQuarterHour } from './reservations-time.utils';

describe('isReservationQuarterHour', () => {
  it.each([
    '2099-06-20T10:00:00.000Z',
    '2099-06-20T10:15:00.000Z',
    '2099-06-20T10:30:00.000Z',
    '2099-06-20T10:45:00.000Z',
  ])('accepts quarter-hour boundaries: %s', (value) => {
    expect(isReservationQuarterHour(value)).toBe(true);
  });

  it.each([
    '2099-06-20T10:07:00.000Z',
    '2099-06-20T21:39:00.000Z',
    '2099-06-20T10:15:01.000Z',
  ])('rejects values outside quarter-hour boundaries: %s', (value) => {
    expect(isReservationQuarterHour(value)).toBe(false);
  });
});
