import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResidentTicketComposerDialog, StaffTicketCard } from './ticket-center.ui';

describe('ticket center ui', () => {
  it('falls back to `Depto` label when resident unit has no building name', () => {
    render(
      <ResidentTicketComposerDialog
        isOpen
        isSubmitting={false}
        units={[{ id: 'unit-101', buildingId: 'b1', number: '101' }]}
        buildingNameById={new Map()}
        unitId=""
        title=""
        description=""
        priority="MEDIUM"
        error={null}
        evidenceFile={null}
        onClose={vi.fn()}
        onUnitChange={vi.fn()}
        onTitleChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onEvidenceChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole('option', { name: 'Depto 101' })).toBeInTheDocument();
  });

  it('shows building and unit context in the staff ticket card', () => {
    render(
      <StaffTicketCard
        ticket={{
          id: 'inc_1',
          clientId: 'client_001',
          buildingId: 'b1',
          unitId: 'unit-101',
          title: 'Fuga de agua',
          description: 'Hay una fuga constante en el piso 2.',
          status: 'ASSIGNED',
          priority: 'HIGH',
          reportedByUserId: 'u_owner',
          assignedToUserId: 'u_staff',
          createdAt: '2026-06-20T10:00:00.000Z',
          updatedAt: '2026-06-20T10:00:00.000Z',
          evidence: [],
        }}
        buildingName="Torre Norte"
        unitLabel="101"
        isSubmitting={false}
        selectedStatus=""
        allowedStatuses={['IN_PROGRESS', 'RESOLVED']}
        onStatusChange={vi.fn()}
        onSaveStatus={vi.fn()}
      />
    );

    expect(screen.getByText('Ubicación')).toBeInTheDocument();
    expect(screen.getByText('Torre Norte')).toBeInTheDocument();
    expect(screen.getByText('Unidad 101')).toBeInTheDocument();
  });
});
