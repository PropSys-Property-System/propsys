'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  createNoticeForUser,
  listNoticesForUser,
  loadAdminNoticesPageData,
  type NoticeBuildingOption,
} from '@/lib/features/notices/notices-center.data';
import { NoticeCard, NoticeComposerDialog } from '@/lib/features/notices/notices-center.ui';
import { labelClient } from '@/lib/presentation/labels';
import type { Notice } from '@/lib/types';

export default function AdminNoticesPage() {
  const { user } = useAuth();
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createClientId, setCreateClientId] = useState('');
  const [createAudience, setCreateAudience] = useState<Notice['audience']>('ALL_BUILDINGS');
  const [createBuildingId, setCreateBuildingId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [buildings, setBuildings] = useState<NoticeBuildingOption[]>([]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await loadAdminNoticesPageData(user);
        if (!isMounted) return;
        setAllNotices(data.notices);
        setBuildings(data.buildings);
        setCreateBuildingId((prev) => prev || data.defaultBuildingId);
        setCreateAudience(data.defaultAudience);
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
    const data = await listNoticesForUser(user);
    setAllNotices(data);
  };

  const isRootPlatform = user?.internalRole === 'ROOT_ADMIN' && user?.scope === 'platform';
  const isBuildingAdmin = user?.internalRole === 'BUILDING_ADMIN';

  const canCreate =
    user?.internalRole === 'ROOT_ADMIN' ||
    user?.internalRole === 'CLIENT_MANAGER' ||
    (isBuildingAdmin && buildings.length > 0);

  const buildingById = useMemo(() => new Map(buildings.map((building) => [building.id, building.name])), [buildings]);

  const clientOptions = useMemo(() => {
    const ids = Array.from(new Set(buildings.map((building) => building.clientId).filter((value): value is string => Boolean(value))));
    return ids
      .sort((a, b) => a.localeCompare(b))
      .map((id) => ({ id, label: labelClient(id) }));
  }, [buildings]);

  const visibleBuildings = useMemo(() => {
    if (!isRootPlatform || !createClientId) return buildings;
    return buildings.filter((building) => building.clientId === createClientId);
  }, [buildings, createClientId, isRootPlatform]);

  const notices = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return allNotices
      .filter(
        (notice) =>
          notice.title.toLowerCase().includes(normalizedTerm) || notice.body.toLowerCase().includes(normalizedTerm)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotices, searchTerm]);

  const openComposer = () => {
    setActionError(null);
    if (isBuildingAdmin) {
      setCreateAudience('BUILDING');
    }
    if (isRootPlatform) {
      setCreateClientId((prev) => prev || clientOptions[0]?.id || '');
    }
    setIsCreateOpen(true);
  };

  const handleClientChange = (clientId: string) => {
    setCreateClientId(clientId);
    const nextBuildings = buildings.filter((building) => building.clientId === clientId);
    setCreateBuildingId(nextBuildings[0]?.id || '');
  };

  const submitCreate = async () => {
    if (!user) return;

    const effectiveAudience: Notice['audience'] = isBuildingAdmin ? 'BUILDING' : createAudience;

    if (isRootPlatform && !createClientId) {
      setActionError('Selecciona un cliente.');
      return;
    }

    if (!createTitle.trim() || !createBody.trim()) {
      setActionError('Completa titulo y contenido.');
      return;
    }

    if (effectiveAudience === 'BUILDING' && !createBuildingId) {
      setActionError('Selecciona un edificio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setActionError(null);
      await createNoticeForUser(user, {
        clientId: isRootPlatform ? createClientId : undefined,
        audience: effectiveAudience,
        buildingId: effectiveAudience === 'BUILDING' ? createBuildingId : undefined,
        title: createTitle.trim(),
        body: createBody.trim(),
      });
      setIsCreateOpen(false);
      setCreateAudience(isBuildingAdmin ? 'BUILDING' : 'ALL_BUILDINGS');
      setCreateTitle('');
      setCreateBody('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No pudimos publicar el aviso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = canCreate ? (
    <button
      onClick={openComposer}
      className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
    >
      <Plus className="w-4 h-4 mr-2" /> Nuevo aviso
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Avisos" description="Publica comunicados para edificios o para todo el portafolio" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Accion no disponible" description={actionError} />}

        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar avisos..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando avisos..." />
        ) : notices.length === 0 ? (
          <EmptyState title="Sin avisos" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aun no se han publicado avisos.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {notices.map((notice) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                buildingName={notice.audience === 'BUILDING' ? (buildingById.get(notice.buildingId ?? '') ?? 'Edificio desconocido') : null}
              />
            ))}
          </div>
        )}
      </div>

      <NoticeComposerDialog
        isOpen={isCreateOpen}
        isSubmitting={isSubmitting}
        isRootPlatform={isRootPlatform}
        isBuildingAdmin={Boolean(isBuildingAdmin)}
        audience={createAudience}
        buildingId={createBuildingId}
        title={createTitle}
        body={createBody}
        clientId={createClientId}
        clientOptions={clientOptions}
        visibleBuildings={visibleBuildings}
        onClose={() => setIsCreateOpen(false)}
        onAudienceChange={setCreateAudience}
        onBuildingChange={setCreateBuildingId}
        onTitleChange={setCreateTitle}
        onBodyChange={setCreateBody}
        onClientChange={handleClientChange}
        onSubmit={submitCreate}
      />
    </div>
  );
}
