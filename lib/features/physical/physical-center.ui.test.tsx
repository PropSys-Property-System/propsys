import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuildingUnitsDialog } from './physical-center.ui';
import type { Building, Unit } from '@/lib/types';

const building: Building = {
  id: 'b1',
  clientId: 'client_001',
  name: 'Torre Norte',
  address: 'Av. 1',
  city: 'Lima',
};

const unit: Unit = {
  id: 'unit-103',
  clientId: 'client_001',
  buildingId: 'b1',
  number: '103',
  floor: '1',
};

function renderDialog(overrides: Partial<Parameters<typeof BuildingUnitsDialog>[0]> = {}) {
  const props: Parameters<typeof BuildingUnitsDialog>[0] = {
    isOpen: true,
    building,
    units: [unit],
    number: '',
    floor: '',
    error: null,
    isLoading: false,
    isSubmitting: false,
    canCreate: true,
    assigningUnit: unit,
    assignmentType: 'OWNER',
    assignmentEmail: '',
    assignmentMessage: null,
    isAssigning: false,
    isUnassigningResident: false,
    onClose: vi.fn(),
    onNumberChange: vi.fn(),
    onFloorChange: vi.fn(),
    onSubmit: vi.fn(),
    onStartAssignment: vi.fn(),
    onCancelAssignment: vi.fn(),
    onAssignmentEmailChange: vi.fn(),
    onAssignUser: vi.fn(),
    onInviteUser: vi.fn(),
    onAssignOwnerAsResident: vi.fn(),
    onUnassignResident: vi.fn(),
    ...overrides,
  };

  render(<BuildingUnitsDialog {...props} />);
  return props;
}

describe('BuildingUnitsDialog assignment UI', () => {
  it('links existing users by email and offers invitation for new owners without password fields', () => {
    const onInviteUser = vi.fn();
    renderDialog({ onInviteUser });

    expect(screen.getByText('Vincular propietario existente')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email del usuario existente')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/contrasena/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/contrasena temporal/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /invitar nuevo propietario/i }));
    expect(onInviteUser).toHaveBeenCalledWith(unit, 'OWNER');
  });

  it('keeps owner-as-resident action visible when an owner exists and resident slot is free', () => {
    renderDialog({
      assigningUnit: null,
      assignmentType: null,
      units: [{ ...unit, ownerId: 'u_owner_existing' }],
    });

    expect(screen.getByRole('button', { name: /propietario vive aqui/i })).toBeInTheDocument();
  });

  it('displays correct labels for creating a new unit', () => {
    renderDialog();
    expect(screen.getByText(/numero de unidad/i)).toBeInTheDocument();
    expect(screen.getByText(/piso/i, { selector: 'label' })).toBeInTheDocument();
  });
});
