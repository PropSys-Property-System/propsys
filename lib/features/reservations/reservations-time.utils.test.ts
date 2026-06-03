import { describe, expect, it } from 'vitest';
import {
  buildReservationDateTime,
  buildReservationTimeOptions,
  isReservationQuarterHour,
} from './reservations-time.utils';

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

describe('buildReservationTimeOptions', () => {
  it('returns a full day of selectable quarter-hour values without free minutes', () => {
    const options = buildReservationTimeOptions();

    expect(options).toHaveLength(96);
    expect(options).toContain('10:00');
    expect(options).toContain('10:15');
    expect(options).toContain('10:30');
    expect(options).toContain('10:45');
    expect(options).not.toContain('10:07');
    expect(options).not.toContain('18:49');
  });
});

describe('buildReservationDateTime', () => {
  it('composes the existing datetime-local value format from controlled fields', () => {
    expect(buildReservationDateTime('2099-06-20', '12:45')).toBe('2099-06-20T12:45');
  });

  it('returns an empty value until both controlled fields are selected', () => {
    expect(buildReservationDateTime('', '12:45')).toBe('');
    expect(buildReservationDateTime('2099-06-20', '')).toBe('');
  });
});
