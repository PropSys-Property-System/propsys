import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsCalendarView } from './reservations-center.ui';
import type { Building, CommonArea, Reservation, Unit } from '@/lib/types';

const buildings: Building[] = [{ id: 'b1', clientId: 'client_001', name: 'Torre A', address: 'Av. 1', city: 'Lima' }];
const areas: CommonArea[] = [
  { id: 'ca-1', clientId: 'client_001', buildingId: 'b1', name: 'Terraza', requiresApproval: true },
  { id: 'ca-2', clientId: 'client_001', buildingId: 'b1', name: 'Parrilla', requiresApproval: true },
];
const units: Unit[] = [
  { id: 'unit-other', clientId: 'client_001', buildingId: 'b1', number: '202' },
  { id: 'unit-101', clientId: 'client_001', buildingId: 'b1', number: '101' },
];

describe('ReservationsCalendarView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders calendar legend with simple status labels', () => {
    render(
      <ReservationsCalendarView
        reservations={[]}
        areas={areas}
        buildings={buildings}
        units={units}
        currentUserId="u_resident"
        isAdmin={false}
      />
    );

    expect(screen.getByText('Leyenda')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(screen.getByText('Solicitada')).toBeInTheDocument();
    expect(screen.getByText('Ocupado')).toBeInTheDocument();
  });

  it('renders sanitized resident availability blocks with area name and without unit details', () => {
    const busyBlock = {
      id: 'busy_1234567890abcdef',
      buildingId: 'b1',
      commonAreaId: 'ca-2',
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

    expect(screen.getByText('Ocupado · Parrilla')).toBeInTheDocument();
    expect(screen.queryByText('Depto 202')).not.toBeInTheDocument();
    expect(screen.queryByText('u_other')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semana anterior' })).toHaveAttribute('title', 'Semana anterior');
    expect(screen.getByRole('button', { name: 'Semana siguiente' })).toHaveAttribute('title', 'Semana siguiente');
  });

  it('keeps admin view detailed for managed reservations', () => {
    const adminReservation: Reservation = {
      id: 'resv_admin',
      buildingId: 'b1',
      unitId: 'unit-101',
      commonAreaId: 'ca-1',
      createdByUserId: 'u_resident',
      startAt: '2026-05-29T10:00:00',
      endAt: '2026-05-29T11:00:00',
      status: 'APPROVED',
    };

    render(
      <ReservationsCalendarView
        reservations={[adminReservation]}
        areas={areas}
        buildings={buildings}
        units={units}
        currentUserId="u_manager"
        isAdmin={true}
      />
    );

    expect(screen.getByText('Terraza')).toBeInTheDocument();
    expect(screen.getByText('Depto 101')).toBeInTheDocument();
  });
});
