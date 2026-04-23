import { Megaphone } from 'lucide-react';
import { formatDateTime } from '@/lib/presentation/dates';
import { labelClient, labelNoticeAudience } from '@/lib/presentation/labels';
import type { Notice } from '@/lib/types';
import type { NoticeBuildingOption } from '@/lib/features/notices/notices-center.data';

type NoticeCardProps = {
  notice: Notice;
  buildingName?: string | null;
};

type ResidentNoticeCardProps = {
  notice: Notice;
};

type ClientOption = {
  id: string;
  label: string;
};

type NoticeComposerDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  isRootPlatform: boolean;
  isBuildingAdmin: boolean;
  audience: Notice['audience'];
  buildingId: string;
  title: string;
  body: string;
  clientId: string;
  clientOptions: ClientOption[];
  visibleBuildings: NoticeBuildingOption[];
  onClose: () => void;
  onAudienceChange: (audience: Notice['audience']) => void;
  onBuildingChange: (buildingId: string) => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onClientChange: (clientId: string) => void;
  onSubmit: () => void;
};

export function NoticeCard({ notice, buildingName }: NoticeCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {notice.clientId && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
              {labelClient(notice.clientId)}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {labelNoticeAudience(notice.audience)}
          </span>
          {notice.audience === 'BUILDING' && (
            <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              {buildingName ?? 'Edificio desconocido'}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            {formatDateTime(notice.createdAt)}
          </span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{notice.title}</p>
        <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">{notice.body}</p>
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Megaphone className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function ResidentNoticeCard({ notice }: ResidentNoticeCardProps) {
  const audienceLabel = notice.audience === 'ALL_BUILDINGS' ? 'PropSys' : labelNoticeAudience(notice.audience);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {audienceLabel}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
            {formatDateTime(notice.createdAt)}
          </span>
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{notice.title}</p>
        <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">{notice.body}</p>
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Megaphone className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function NoticeComposerDialog({
  isOpen,
  isSubmitting,
  isRootPlatform,
  isBuildingAdmin,
  audience,
  buildingId,
  title,
  body,
  clientId,
  clientOptions,
  visibleBuildings,
  onClose,
  onAudienceChange,
  onBuildingChange,
  onTitleChange,
  onBodyChange,
  onClientChange,
  onSubmit,
}: NoticeComposerDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={onClose} type="button" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Nuevo aviso</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Publica un comunicado para edificios o para todos los edificios.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {isRootPlatform && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Cliente</label>
              <select
                value={clientId}
                onChange={(event) => onClientChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {clientOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Alcance</label>
            <select
              value={isBuildingAdmin ? 'BUILDING' : audience}
              onChange={(event) => onAudienceChange(event.target.value as Notice['audience'])}
              disabled={isBuildingAdmin}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium disabled:opacity-70"
            >
              <option value="ALL_BUILDINGS">Todos los edificios</option>
              <option value="BUILDING">Edificio</option>
            </select>
          </div>

          {(isBuildingAdmin || audience === 'BUILDING') && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
              <select
                value={buildingId}
                onChange={(event) => onBuildingChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {visibleBuildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Titulo</label>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Contenido</label>
            <textarea
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium min-h-[140px]"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onSubmit}
            className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
