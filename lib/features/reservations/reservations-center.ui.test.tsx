import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsCalendarView } from './reservations-center.ui';
import type { Building, CommonArea, Reservation, Unit } from '@/lib/types';

const buildings: Building[] = [{ id: 'b1', clientId: 'client_001', name: 'Torre A', address: 'Av. 1', city: 'Lima' }];
const areas: CommonArea[] = [{ id: 'ca-1', clientId: 'client_001', buildingId: 'b1', name: 'Terraza', requiresApproval: true }];
const units: Unit[] = [{ id: 'unit-other', clientId: 'client_001', buildingId: 'b1', number: '202' }];

describe('ReservationsCalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders sanitized resident availability blocks as Ocupado without unit details', () => {
    const busyBlock = {
      id: 'busy_1234567890abcdef',
      buildingId: 'b1',
      commonAreaId: 'ca-1',
      startAt: '2026-05-29T10:00:00',
      endAt: '2026-05-29T11:00:00',
      busy: true,
    } as unknown as Reservation;

    render(
      <ReservationsCalendarView
        reservations={[busyBlock]}
        areas={areas}
        buildings={buildings}
        units={units}
        currentUserId="u_resident"
        isAdmin={false}
      />
    );

    expect(screen.getByText('Ocupado')).toBeInTheDocument();
    expect(screen.queryByText('Depto 202')).not.toBeInTheDocument();
  });
});
