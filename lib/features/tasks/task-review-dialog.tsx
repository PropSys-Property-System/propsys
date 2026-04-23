import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { formatDateTime } from '@/lib/presentation/dates';
import { labelChecklistExecutionStatus, TaskEvidenceList } from '@/lib/features/tasks/task-center.ui';
import type { ChecklistExecution, ChecklistTemplate, EvidenceAttachment, TaskEntity } from '@/lib/types';

type TaskReviewDialogProps = {
  isOpen: boolean;
  task: TaskEntity | null;
  buildingName: string | null;
  template: ChecklistTemplate | null;
  execution: ChecklistExecution | null;
  evidence: EvidenceAttachment[];
  reviewResultsByItemId: Map<string, boolean>;
  reviewCommentDraft: string;
  actionError: string | null;
  isReviewLoading: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onReturn: () => void;
  onApprove: () => void;
};

export function TaskReviewDialog({
  isOpen,
  task,
  buildingName,
  template,
  execution,
  evidence,
  reviewResultsByItemId,
  reviewCommentDraft,
  actionError,
  isReviewLoading,
  isSubmitting,
  onClose,
  onCommentChange,
  onReturn,
  onApprove,
}: TaskReviewDialogProps) {
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
            <p className="text-lg font-black text-slate-900 truncate">Revision del checklist</p>
            <p className="mt-1 text-xs text-slate-500 font-medium truncate">{task.title}</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400 truncate">Edificio: {buildingName ?? task.buildingId}</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        {actionError && (
          <div className="mt-4">
            <ErrorState title="Accion no disponible" description={actionError} />
          </div>
        )}

        <div className="mt-5 min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
          {isReviewLoading ? (
            <LoadingState title="Cargando revision..." />
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {template?.name ?? 'Checklist no disponible'}
                  </span>
                  {execution && (
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {labelChecklistExecutionStatus(execution.status)}
                    </span>
                  )}
                </div>
                {execution ? (
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">Ultima actualizacion {formatDateTime(execution.updatedAt)}</p>
                ) : (
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">El staff todavia no inicio este checklist.</p>
                )}
              </div>

              {execution?.lastReviewAction === 'RETURN' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-amber-800">Ultima correccion solicitada</p>
                  <p className="mt-2 text-[11px] font-semibold text-amber-900">
                    {execution.reviewedAt ? `Registrada ${formatDateTime(execution.reviewedAt)}` : 'Registrada por administracion'}
                  </p>
                  <p className="mt-2 text-sm font-medium text-amber-900">{execution.reviewComment?.trim() || 'Sin comentario adicional.'}</p>
                </div>
              )}

              {!execution ? (
                <EmptyState title="Checklist sin iniciar" description="Todavia no hay respuestas ni evidencias para revisar en esta tarea." />
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Items</p>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {execution.results.length} respuestas
                      </span>
                    </div>
                    {template ? (
                      <div className="space-y-2">
                        {template.items.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <input
                              type="checkbox"
                              checked={Boolean(reviewResultsByItemId.get(item.id))}
                              readOnly
                              disabled
                              className="mt-1 h-4 w-4"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-black text-slate-900">{item.label}</span>
                              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {item.required ? 'Requerido' : 'Opcional'}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">
                        No pudimos cargar el template asociado a esta ejecucion.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Evidencias</p>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{evidence.length} adjuntos</span>
                    </div>
                    <TaskEvidenceList evidence={evidence} showUploadedAt />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Comentario para la correccion (opcional)
                    </label>
                    <textarea
                      value={reviewCommentDraft}
                      onChange={(event) => onCommentChange(event.target.value)}
                      disabled={isSubmitting || isReviewLoading}
                      placeholder="Indica qué debe corregir el staff antes de volver a enviarlo."
                      className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5 disabled:opacity-70"
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
          >
            Cerrar
          </button>
          {execution && (execution.status === 'COMPLETED' || execution.status === 'APPROVED') && (
            <button
              type="button"
              disabled={isSubmitting || isReviewLoading}
              onClick={onReturn}
              className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-amber-700 font-black text-sm hover:bg-amber-50 transition-all disabled:opacity-70"
            >
              {execution.status === 'APPROVED' ? 'Quitar aprobacion y enviar a correccion' : 'Enviar a correccion'}
            </button>
          )}
          {execution?.status === 'COMPLETED' && (
            <button
              type="button"
              disabled={isSubmitting || isReviewLoading}
              onClick={onApprove}
              className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all disabled:opacity-70"
            >
              Aprobar checklist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
