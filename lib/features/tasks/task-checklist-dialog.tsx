import { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';
import { ErrorState } from '@/components/States';
import { DraftEvidenceCard, labelChecklistExecutionStatus, TaskEvidenceList } from '@/lib/features/tasks/task-center.ui';
import type { ChecklistExecution, ChecklistTemplate, EvidenceAttachment, TaskEntity } from '@/lib/types';

type TaskChecklistDialogProps = {
  isOpen: boolean;
  task: TaskEntity | null;
  buildingName: string | null;
  actionError: string | null;
  activeTemplate: ChecklistTemplate | null;
  execution: ChecklistExecution | null;
  resultsByItemId: Record<string, boolean>;
  evidence: EvidenceAttachment[];
  evidenceFile: File | null;
  evidencePreviewUrl: string | null;
  isItemsReadOnly: boolean;
  isEvidenceLocked: boolean;
  isChecklistCompletable: boolean;
  isSubmitting: boolean;
  currentUserId?: string;
  onClose: () => void;
  onSelectEvidenceFile: (file: File | null) => void;
  onClearEvidenceDraft: () => void;
  onToggleResult: (itemId: string, value: boolean) => void;
  onSaveChecklist: () => void;
  onCompleteChecklist: () => void;
  onUploadEvidence: () => void;
  onDeleteEvidence: (evidence: EvidenceAttachment) => void;
};

export function TaskChecklistDialog({
  isOpen,
  task,
  buildingName,
  actionError,
  activeTemplate,
  execution,
  resultsByItemId,
  evidence,
  evidenceFile,
  evidencePreviewUrl,
  isItemsReadOnly,
  isEvidenceLocked,
  isChecklistCompletable,
  isSubmitting,
  currentUserId,
  onClose,
  onSelectEvidenceFile,
  onClearEvidenceDraft,
  onToggleResult,
  onSaveChecklist,
  onCompleteChecklist,
  onUploadEvidence,
  onDeleteEvidence,
}: TaskChecklistDialogProps) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex min-h-0 max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-black text-slate-900 truncate">Checklist</p>
            <p className="mt-1 text-xs text-slate-500 font-medium truncate">{task.title}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400 truncate">Edificio: {buildingName ?? task.buildingId}</p>
            <p className="mt-3 text-[11px] text-slate-400 font-semibold">Adjunta una foto o un archivo PDF como evidencia del checklist.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        {actionError && (
          <div className="mt-4">
            <ErrorState title="Acción no disponible" description={actionError} />
          </div>
        )}

        <div className="mt-5 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {execution?.lastReviewAction === 'RETURN' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-amber-800">Devuelto por administración</p>
              <p className="mt-2 text-[11px] font-semibold text-amber-900">
                {execution.reviewedAt ? `Revisado ${new Date(execution.reviewedAt).toLocaleString('es-PE')}` : 'Pendiente de corrección'}
              </p>
              <p className="mt-2 text-sm font-medium text-amber-900">{execution.reviewComment?.trim() || 'Corrige el checklist y vuelve a enviarlo.'}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Checklist</label>
            {activeTemplate ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 font-black">{activeTemplate.name}</div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                Esta tarea no tiene checklist asignado o el checklist ya no está disponible.
              </div>
            )}
          </div>

          {activeTemplate && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Items</p>
                {execution && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {labelChecklistExecutionStatus(execution.status)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {activeTemplate.items.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 rounded-2xl border border-slate-200 p-4 ${isItemsReadOnly ? 'bg-slate-50' : 'bg-white'}`}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(resultsByItemId[item.id])}
                      disabled={isItemsReadOnly}
                      onChange={(event) => onToggleResult(item.id, event.target.checked)}
                      className="mt-1 h-4 w-4"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-black text-slate-900">{item.label}</span>
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {item.required ? 'Requerido' : 'Opcional'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  disabled={isSubmitting || !activeTemplate || isItemsReadOnly}
                  onClick={onSaveChecklist}
                  className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !activeTemplate || isItemsReadOnly || !isChecklistCompletable}
                  onClick={onCompleteChecklist}
                  className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
                >
                  Completar
                </button>
              </div>
              {!isItemsReadOnly && activeTemplate && !isChecklistCompletable && (
                <p className="text-[11px] text-slate-400 font-semibold">Marca todos los items requeridos para completar el checklist.</p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Evidencias</p>
            <div className="flex flex-col gap-3">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  onSelectEvidenceFile(event.target.files?.[0] ?? null);
                  event.currentTarget.value = '';
                }}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(event) => {
                  onSelectEvidenceFile(event.target.files?.[0] ?? null);
                  event.currentTarget.value = '';
                }}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isSubmitting || Boolean(isEvidenceLocked) || !activeTemplate}
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Tomar foto
                </button>
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={isSubmitting || Boolean(isEvidenceLocked) || !activeTemplate}
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Adjuntar archivo
                </button>
                <button
                  type="button"
                  onClick={onUploadEvidence}
                  disabled={isSubmitting || Boolean(isEvidenceLocked) || !activeTemplate || !evidenceFile}
                  className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
                >
                  Guardar evidencia
                </button>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold">Puedes tomar una foto o adjuntar una imagen JPG/PNG/WEBP o un PDF de hasta 10 MB.</p>
              {evidenceFile && (
                <DraftEvidenceCard
                  file={evidenceFile}
                  previewUrl={evidencePreviewUrl}
                  onRemove={onClearEvidenceDraft}
                  disabled={isSubmitting}
                />
              )}
              {isEvidenceLocked && (
                <p className="text-[11px] text-slate-400 font-semibold">No se pueden adjuntar evidencias cuando el checklist ya está aprobado.</p>
              )}
            </div>

            <TaskEvidenceList
              evidence={evidence}
              canDeleteEvidence={(item) => !isEvidenceLocked && item.uploadedByUserId === currentUserId}
              onDeleteEvidence={onDeleteEvidence}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
