'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Megaphone, Plus, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, noticesRepo } from '@/lib/data';
import { Notice } from '@/lib/types';
import { labelNoticeAudience } from '@/lib/presentation/labels';

export default function AdminNoticesPage() {
  const { user } = useAuth();
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createAudience, setCreateAudience] = useState<Notice['audience']>('ALL_BUILDINGS');
  const [createBuildingId, setCreateBuildingId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [buildings, setBuildings] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await noticesRepo.listForUser(user);
        const b = await buildingsRepo.listForUser(user);
        if (!isMounted) return;
        setAllNotices(data);
        setBuildings(b.map((x) => ({ id: x.id, name: x.name })));
        setCreateBuildingId((prev) => prev || b[0]?.id || '');
        if (user.internalRole === 'BUILDING_ADMIN') {
          setCreateAudience('BUILDING');
        }
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los avisos.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const reload = async () => {
    if (!user) return;
    setActionError(null);
    const data = await noticesRepo.listForUser(user);
    setAllNotices(data);
  };

  const canCreate = user?.internalRole === 'CLIENT_MANAGER' || (user?.internalRole === 'BUILDING_ADMIN' && buildings.length > 0);

  const submitCreate = async () => {
    if (!user) return;
    const effectiveAudience: Notice['audience'] = user.internalRole === 'BUILDING_ADMIN' ? 'BUILDING' : createAudience;
    if (!createTitle.trim() || !createBody.trim()) {
      setActionError('Completa título y contenido.');
      return;
    }
    if (effectiveAudience === 'BUILDING' && !createBuildingId) {
      setActionError('Selecciona un edificio.');
      return;
    }
    try {
      setIsSubmitting(true);
      setActionError(null);
      await noticesRepo.createAndPublishForUser(user, {
        audience: effectiveAudience,
        buildingId: effectiveAudience === 'BUILDING' ? createBuildingId : undefined,
        title: createTitle.trim(),
        body: createBody.trim(),
      });
      setIsCreateOpen(false);
      setCreateAudience(user.internalRole === 'BUILDING_ADMIN' ? 'BUILDING' : 'ALL_BUILDINGS');
      setCreateTitle('');
      setCreateBody('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos publicar el aviso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const notices = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allNotices
      .filter((n) => n.title.toLowerCase().includes(t) || n.body.toLowerCase().includes(t))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotices, searchTerm]);

  const actions = canCreate ? (
    <button
      onClick={() => {
        setActionError(null);
        if (user?.internalRole === 'BUILDING_ADMIN') setCreateAudience('BUILDING');
        setIsCreateOpen(true);
      }}
      className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
    >
      <Plus className="w-4 h-4 mr-2" /> Nuevo aviso
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Avisos" description="Publica comunicados para edificios o para todo el portafolio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Acción no disponible" description={actionError} />}

        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar avisos..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando avisos..." />
        ) : notices.length === 0 ? (
          <EmptyState title="Sin avisos" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no se han publicado avisos.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {notices.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {labelNoticeAudience(n.audience)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      {new Date(n.createdAt).toLocaleString('es-CL')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900">{n.title}</p>
                  <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">{n.body}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsCreateOpen(false)} type="button" />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">Nuevo aviso</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">Publica un comunicado para edificios o para todos los edificios.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
                Cerrar
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Alcance</label>
                <select
                  value={user?.internalRole === 'BUILDING_ADMIN' ? 'BUILDING' : createAudience}
                  onChange={(e) => setCreateAudience(e.target.value as Notice['audience'])}
                  disabled={user?.internalRole === 'BUILDING_ADMIN'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium disabled:opacity-70"
                >
                  <option value="ALL_BUILDINGS">Todos los edificios</option>
                  <option value="BUILDING">Edificio</option>
                </select>
              </div>

              {(user?.internalRole === 'BUILDING_ADMIN' || createAudience === 'BUILDING') && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Edificio</label>
                  <select
                    value={createBuildingId}
                    onChange={(e) => setCreateBuildingId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                  >
                    <option value="" disabled>
                      Selecciona...
                    </option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Título</label>
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Contenido</label>
                <textarea
                  value={createBody}
                  onChange={(e) => setCreateBody(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium min-h-[140px]"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={submitCreate}
                className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

