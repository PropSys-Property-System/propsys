'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  archiveCommonAreaForUser,
  createCommonAreaForUser,
  listArchivedCommonAreasForBuilding,
  listCommonAreasForBuilding,
  loadAdminCommonAreasPageData,
  restoreCommonAreaForUser,
  updateCommonAreaForUser,
  updateCommonAreaApprovalForUser,
} from '@/lib/features/physical/physical-center.data';
import { BuildingScopeToolbar, CommonAreaCard, buildingToolbarIcon } from '@/lib/features/physical/physical-center.ui';
import type { Building, CommonArea } from '@/lib/types';

export default function AdminCommonAreasPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [archivedAreas, setArchivedAreas] = useState<CommonArea[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savingAreaId, setSavingAreaId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CommonArea | null>(null);
  const [composerName, setComposerName] = useState('');
  const [composerCapacity, setComposerCapacity] = useState('');
  const [composerRequiresApproval, setComposerRequiresApproval] = useState(true);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageApproval = user?.internalRole === 'CLIENT_MANAGER' || user?.internalRole === 'ROOT_ADMIN';

  useEffect(() => {
    let isMounted = true;

    const loadBuildings = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminCommonAreasPageData(user);
        if (!isMounted) return;
        setBuildings(data.buildings);
        setSelectedBuildingId((prev) => prev || data.defaultBuildingId);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los edificios.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadBuildings();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadAreas = async () => {
      if (!user || !selectedBuildingId) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const [active, archived] = await Promise.all([
          listCommonAreasForBuilding(user, selectedBuildingId),
          listArchivedCommonAreasForBuilding(user, selectedBuildingId),
        ]);
        if (!isMounted) return;
        setAreas(active);
        setArchivedAreas(archived);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar las areas comunes.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadAreas();

    return () => {
      isMounted = false;
    };
  }, [selectedBuildingId, user]);

  const filteredAreas = useMemo(() => {
    const source = showArchived ? archivedAreas : areas;
    const normalizedTerm = searchTerm.toLowerCase();
    return source.filter((area) => area.name.toLowerCase().includes(normalizedTerm));
  }, [areas, archivedAreas, searchTerm, showArchived]);

  const updateApproval = async (area: CommonArea, nextRequiresApproval: boolean) => {
    if (!user) return;

    try {
      setSavingAreaId(area.id);
      setActionError(null);
      setActionMessage(null);
      const updated = await updateCommonAreaApprovalForUser(user, area.id, nextRequiresApproval);
      setAreas((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setActionMessage(`Area comun ${updated.name} actualizada.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el area comun.');
    } finally {
      setSavingAreaId(null);
    }
  };

  function openCreate() {
    if (!canManageApproval || !selectedBuildingId) return;
    setEditingArea(null);
    setComposerName('');
    setComposerCapacity('');
    setComposerRequiresApproval(true);
    setComposerError(null);
    setIsComposerOpen(true);
  }

  function openEdit(area: CommonArea) {
    setEditingArea(area);
    setComposerName(area.name);
    setComposerCapacity(String(area.capacity ?? ''));
    setComposerRequiresApproval(area.requiresApproval);
    setComposerError(null);
    setIsComposerOpen(true);
  }

  async function submitComposer() {
    if (!user || !selectedBuildingId) return;
    const capacity = Number(composerCapacity);
    if (!composerName.trim() || !Number.isFinite(capacity) || capacity < 1) {
      setComposerError('Completa nombre y capacidad valida.');
      return;
    }
    try {
      setIsSubmitting(true);
      setComposerError(null);
      setActionError(null);
      setActionMessage(null);
      if (editingArea) {
        const updated = await updateCommonAreaForUser(user, {
          id: editingArea.id,
          name: composerName.trim(),
          capacity,
          requiresApproval: composerRequiresApproval,
        });
        setAreas((current) => current.map((area) => (area.id === updated.id ? updated : area)));
        setActionMessage(`Area comun ${updated.name} actualizada.`);
      } else {
        const created = await createCommonAreaForUser(user, {
          buildingId: selectedBuildingId,
          name: composerName.trim(),
          capacity,
          requiresApproval: composerRequiresApproval,
        });
        setAreas((current) => [created, ...current]);
        setActionMessage(`Area comun ${created.name} creada.`);
      }
      setIsComposerOpen(false);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'No pudimos guardar el area comun.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function archiveArea(area: CommonArea) {
    if (!user) return;
    const confirmed = window.confirm(`Archivar "${area.name}"?`);
    if (!confirmed) return;
    try {
      setActionError(null);
      setActionMessage(null);
      const archived = await archiveCommonAreaForUser(user, area.id);
      setAreas((current) => current.filter((item) => item.id !== area.id));
      setArchivedAreas((current) => [archived, ...current]);
      setActionMessage(`Area comun ${archived.name} archivada.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos archivar el area comun.');
    }
  }

  async function restoreArea(area: CommonArea) {
    if (!user) return;
    const confirmed = window.confirm(`Restaurar "${area.name}"?`);
    if (!confirmed) return;
    try {
      setActionError(null);
      setActionMessage(null);
      const restored = await restoreCommonAreaForUser(user, area.id);
      setArchivedAreas((current) => current.filter((item) => item.id !== area.id));
      setAreas((current) => [restored, ...current]);
      setShowArchived(false);
      setActionMessage(`Area comun ${restored.name} restaurada.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos restaurar el area comun.');
    }
  }

  const actions = canManageApproval ? (
    <button
      type="button"
      onClick={openCreate}
      disabled={!selectedBuildingId}
      className={`flex items-center px-4 py-2 rounded-xl font-bold text-sm transition-all ${
        selectedBuildingId ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
      }`}
    >
      <Plus className="w-4 h-4 mr-2" /> Nueva area comun
    </button>
  ) : null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Areas Comunes" description="Configura espacios reservables y reglas de aprobacion" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {actionError && <ErrorState title="Accion no disponible" description={actionError} />}
        {actionMessage ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{actionMessage}</div>
        ) : null}

        {canManageApproval ? (
          <div className="inline-flex p-1 bg-white border border-slate-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${!showArchived ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Activas ({areas.length})
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${showArchived ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Archivadas ({archivedAreas.length})
            </button>
          </div>
        ) : null}

        {buildings.length > 1 && (
          <BuildingScopeToolbar
            title="Edificio"
            icon={buildingToolbarIcon()}
            buildings={buildings}
            selectedBuildingId={selectedBuildingId}
            searchTerm={searchTerm}
            searchPlaceholder="Buscar area comun..."
            onBuildingChange={setSelectedBuildingId}
            onSearchChange={setSearchTerm}
          />
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando areas comunes..." />
        ) : !selectedBuildingId ? (
          <EmptyState title="Sin edificio" description="No hay un edificio seleccionado." />
        ) : filteredAreas.length === 0 ? (
          <EmptyState title="Sin areas" description={searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'Aun no hay areas comunes configuradas.'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
            {filteredAreas.map((area) => (
              <CommonAreaCard
                key={area.id}
                area={area}
                canManageApproval={Boolean(canManageApproval)}
                savingAreaId={savingAreaId}
                onToggleApproval={updateApproval}
                onEdit={openEdit}
                onArchive={archiveArea}
                onRestore={restoreArea}
                showArchived={showArchived}
              />
            ))}
          </div>
        )}
      </div>
      {isComposerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/30" onClick={() => setIsComposerOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <p className="text-lg font-black text-slate-900">{editingArea ? 'Editar area comun' : 'Nueva area comun'}</p>
            <div className="mt-4 space-y-3">
              <input
                value={composerName}
                onChange={(event) => setComposerName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Nombre del area"
              />
              <input
                type="number"
                min="1"
                step="1"
                value={composerCapacity}
                onChange={(event) => setComposerCapacity(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Capacidad"
              />
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={composerRequiresApproval}
                  onChange={(event) => setComposerRequiresApproval(event.target.checked)}
                />
                Requiere aprobacion
              </label>
              {composerError ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{composerError}</div>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitComposer()}
                disabled={isSubmitting}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {isSubmitting ? 'Guardando...' : editingArea ? 'Guardar cambios' : 'Crear area'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
