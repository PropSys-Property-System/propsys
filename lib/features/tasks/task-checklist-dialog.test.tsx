import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskChecklistDialog } from './task-checklist-dialog';

const baseTask = {
  id: 'task_1',
  clientId: 'client_001',
  buildingId: 'b1',
  checklistTemplateId: 'tmpl_1',
  title: 'Checklist de limpieza',
  description: 'Turno mañana',
  status: 'IN_PROGRESS' as const,
  assignedToUserId: 'staff_1',
  createdByUserId: 'manager_1',
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T11:00:00.000Z',
};

const baseTemplate = {
  id: 'tmpl_1',
  clientId: 'client_001',
  buildingId: 'b1',
  name: 'Checklist diario',
  items: [
    { id: 'item_1', label: 'Revisar pasillo', required: true },
    { id: 'item_2', label: 'Tomar lectura', required: true },
    { id: 'item_3', label: 'Firmar observación', required: false },
  ],
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T11:00:00.000Z',
};

const baseExecution = {
  id: 'exec_1',
  clientId: 'client_001',
  buildingId: 'b1',
  taskId: 'task_1',
  templateId: 'tmpl_1',
  assignedToUserId: 'staff_1',
  status: 'PENDING' as const,
  results: [],
  createdAt: '2026-06-20T10:00:00.000Z',
  updatedAt: '2026-06-20T11:00:00.000Z',
};

function createFile(name: string, type: string) {
  return new File(['demo'], name, { type });
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof TaskChecklistDialog>> = {}) {
  const onToggleResult = vi.fn();
  const onSaveChecklist = vi.fn();
  const onCompleteChecklist = vi.fn();
  const onUploadEvidence = vi.fn();
  const onDeleteEvidence = vi.fn();

  const renderResult = render(
    <TaskChecklistDialog
      isOpen
      task={baseTask}
      buildingName="Torre Norte"
      actionError={null}
      checklistLoadError={null}
      evidenceLoadError={null}
      activeTemplate={baseTemplate}
      execution={baseExecution}
      resultsByItemId={{ item_1: true }}
      evidence={[
        {
          id: 'ev_1',
          clientId: 'client_001',
          buildingId: 'b1',
          checklistExecutionId: 'exec_1',
          fileName: 'foto.jpg',
          mimeType: 'image/jpeg',
          url: 'https://example.com/foto.jpg',
          uploadedByUserId: 'staff_1',
          createdAt: '2026-06-20T10:00:00.000Z',
        },
      ]}
      evidenceFile={createFile('adjunto.jpg', 'image/jpeg')}
      evidencePreviewUrl={null}
      isChecklistLoading={false}
      isItemsReadOnly={false}
      isEvidenceLocked={false}
      isChecklistCompletable={false}
      isSubmitting={false}
      currentUserId="staff_1"
      onClose={vi.fn()}
      onSelectEvidenceFile={vi.fn()}
      onClearEvidenceDraft={vi.fn()}
      onToggleResult={onToggleResult}
      onSaveChecklist={onSaveChecklist}
      onCompleteChecklist={onCompleteChecklist}
      onUploadEvidence={onUploadEvidence}
      onDeleteEvidence={onDeleteEvidence}
      {...overrides}
    />
  );

  return {
    ...renderResult,
    onToggleResult,
    onSaveChecklist,
    onCompleteChecklist,
    onUploadEvidence,
    onDeleteEvidence,
  };
}

describe('TaskChecklistDialog', () => {
  it('shows checklist progress and preserves evidence input attributes', () => {
    const { container } = renderDialog();

    expect(screen.getByText('1 de 2 items requeridos completados')).toBeInTheDocument();

    const cameraInput = container.querySelector('input[capture="environment"]');
    const uploadInput = container.querySelector('input[accept="image/*,application/pdf"]');

    expect(cameraInput).toHaveAttribute('accept', 'image/*');
    expect(cameraInput).toHaveAttribute('capture', 'environment');
    expect(uploadInput).toHaveAttribute('accept', 'image/*,application/pdf');

    expect(screen.getByText('En móvil, abre la cámara si el dispositivo lo permite.')).toBeInTheDocument();
    expect(screen.getByText('Selecciona una imagen o PDF desde tu dispositivo.')).toBeInTheDocument();
  });

  it('renders differentiated load messages and existing evidence', () => {
    renderDialog({
      activeTemplate: null,
      checklistLoadError: 'El checklist asignado ya no esta disponible.',
      evidenceLoadError: 'No pudimos cargar las evidencias de esta tarea. Intenta nuevamente.',
      evidence: [
        {
          id: 'ev_1',
          clientId: 'client_001',
          buildingId: 'b1',
          checklistExecutionId: 'exec_1',
          fileName: 'foto.jpg',
          mimeType: 'image/jpeg',
          url: 'https://example.com/foto.jpg',
          uploadedByUserId: 'staff_1',
          createdAt: '2026-06-20T10:00:00.000Z',
        },
      ],
    });

    expect(screen.getByText('El checklist asignado ya no esta disponible.')).toBeInTheDocument();
    expect(screen.getByText('No pudimos cargar las evidencias de esta tarea. Intenta nuevamente.')).toBeInTheDocument();
    expect(screen.getByText('foto.jpg')).toBeInTheDocument();
  });

  it('keeps checklist and evidence actions working', () => {
    const { onSaveChecklist, onCompleteChecklist, onUploadEvidence, onDeleteEvidence } = renderDialog({
      isChecklistCompletable: true,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Completar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar evidencia' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(onSaveChecklist).toHaveBeenCalled();
    expect(onCompleteChecklist).toHaveBeenCalled();
    expect(onUploadEvidence).toHaveBeenCalled();
    expect(onDeleteEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ev_1',
      })
    );
  });

  it('renders loading and no-checklist messages when applicable', () => {
    const { rerender } = render(
      <TaskChecklistDialog
        isOpen
        task={{ ...baseTask, checklistTemplateId: undefined }}
        buildingName="Torre Norte"
        actionError={null}
        checklistLoadError={null}
        evidenceLoadError={null}
        activeTemplate={null}
        execution={null}
        resultsByItemId={{}}
        evidence={[]}
        evidenceFile={null}
        evidencePreviewUrl={null}
        isChecklistLoading
        isItemsReadOnly={false}
        isEvidenceLocked={false}
        isChecklistCompletable={false}
        isSubmitting={false}
        currentUserId="staff_1"
        onClose={vi.fn()}
        onSelectEvidenceFile={vi.fn()}
        onClearEvidenceDraft={vi.fn()}
        onToggleResult={vi.fn()}
        onSaveChecklist={vi.fn()}
        onCompleteChecklist={vi.fn()}
        onUploadEvidence={vi.fn()}
        onDeleteEvidence={vi.fn()}
      />
    );

    expect(screen.getByText('Cargando checklist...')).toBeInTheDocument();

    rerender(
      <TaskChecklistDialog
        isOpen
        task={{ ...baseTask, checklistTemplateId: undefined }}
        buildingName="Torre Norte"
        actionError={null}
        checklistLoadError={null}
        evidenceLoadError={null}
        activeTemplate={null}
        execution={null}
        resultsByItemId={{}}
        evidence={[]}
        evidenceFile={null}
        evidencePreviewUrl={null}
        isChecklistLoading={false}
        isItemsReadOnly={false}
        isEvidenceLocked={false}
        isChecklistCompletable={false}
        isSubmitting={false}
        currentUserId="staff_1"
        onClose={vi.fn()}
        onSelectEvidenceFile={vi.fn()}
        onClearEvidenceDraft={vi.fn()}
        onToggleResult={vi.fn()}
        onSaveChecklist={vi.fn()}
        onCompleteChecklist={vi.fn()}
        onUploadEvidence={vi.fn()}
        onDeleteEvidence={vi.fn()}
      />
    );

    expect(screen.getByText('Esta tarea no tiene checklist asignado.')).toBeInTheDocument();
  });
});
