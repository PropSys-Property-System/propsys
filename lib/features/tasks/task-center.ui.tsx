import Image from 'next/image';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/presentation/dates';
import type { ChecklistExecution, EvidenceAttachment, TaskEntity } from '@/lib/types';

export const taskImageLoader = ({ src }: { src: string }) => src;

export function labelTaskStatus(status: TaskEntity['status']): string {
  if (status === 'APPROVED') return 'Aprobada';
  if (status === 'COMPLETED') return 'Completada';
  if (status === 'IN_PROGRESS') return 'En progreso';
  return 'Pendiente';
}

export function labelChecklistExecutionStatus(status: ChecklistExecution['status']): string {
  if (status === 'APPROVED') return 'Aprobado';
  if (status === 'COMPLETED') return 'Completado';
  return 'Pendiente';
}

function isEvidenceImage(fileName: string, mimeType: string): boolean {
  return mimeType.startsWith('image/') || /\.(png|jpg|jpeg|webp)$/i.test(fileName);
}

function isEvidencePdf(fileName: string, mimeType: string): boolean {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(fileName);
}

function labelEvidenceType(fileName: string, mimeType: string): string {
  if (isEvidencePdf(fileName, mimeType)) return 'PDF';
  if (isEvidenceImage(fileName, mimeType)) return 'Imagen';
  return mimeType;
}

function EvidenceThumb({
  src,
  alt,
  isImage,
}: {
  src: string;
  alt: string;
  isImage: boolean;
}) {
  if (isImage) {
    return (
      <Image
        loader={taskImageLoader}
        unoptimized
        src={src}
        alt={alt}
        width={56}
        height={56}
        className="h-14 w-14 rounded-xl object-cover border border-slate-200"
      />
    );
  }

  return (
    <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
      <FileText className="h-6 w-6 text-slate-500" />
    </div>
  );
}

export function DraftEvidenceCard({
  file,
  previewUrl,
  onRemove,
  disabled = false,
}: {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
      <EvidenceThumb src={previewUrl ?? ''} alt={file.name} isImage={Boolean(previewUrl)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-slate-900 truncate">{file.name}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium">{Math.ceil(file.size / 1024)} KB</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700 disabled:opacity-60"
      >
        Quitar
      </button>
    </div>
  );
}

export function TaskEvidenceList({
  evidence,
  emptyText = 'Sin evidencias adjuntas.',
  showUploadedAt = false,
  canDeleteEvidence,
  onDeleteEvidence,
  isSubmitting = false,
}: {
  evidence: EvidenceAttachment[];
  emptyText?: string;
  showUploadedAt?: boolean;
  canDeleteEvidence?: (evidence: EvidenceAttachment) => boolean;
  onDeleteEvidence?: (evidence: EvidenceAttachment) => void;
  isSubmitting?: boolean;
}) {
  if (evidence.length === 0) {
    return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 font-semibold">{emptyText}</div>;
  }

  return (
    <div className="space-y-2">
      {evidence.map((item) => {
        const image = isEvidenceImage(item.fileName, item.mimeType);
        const deletable = Boolean(canDeleteEvidence?.(item) && onDeleteEvidence);

        return (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-4">
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                <EvidenceThumb src={item.url} alt={item.fileName} isImage={image} />
              </a>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900 truncate">{item.fileName}</p>
                <p className="mt-1 text-xs text-slate-500 font-medium truncate">
                  {labelEvidenceType(item.fileName, item.mimeType)}
                  {typeof item.sizeBytes === 'number' ? ` · ${Math.ceil(item.sizeBytes / 1024)} KB` : ''}
                </p>
                {showUploadedAt && (
                  <p className="mt-1 text-[11px] font-semibold text-slate-400 truncate">Subido {formatDateTime(item.createdAt)}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Abrir
                  </a>
                  {deletable && (
                    <button
                      type="button"
                      onClick={() => onDeleteEvidence?.(item)}
                      disabled={isSubmitting}
                      className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-slate-200 text-rose-700 font-bold text-xs hover:bg-rose-50 transition-all disabled:opacity-70"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
