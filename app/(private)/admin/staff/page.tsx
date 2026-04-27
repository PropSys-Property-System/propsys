'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import { createStaffForBuilding, listStaffForBuilding, loadAdminStaffPageData } from '@/lib/features/physical/physical-center.data';
import { BuildingScopeToolbar, StaffCard, buildingToolbarIcon } from '@/lib/features/physical/physical-center.ui';
import type { Building, StaffMember } from '@/lib/types';

export default function AdminStaffPage() {
  const { user } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState('');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdStaff, setCreatedStaff] = useState<{ staff: StaffMember; tempPassword?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBuildings = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminStaffPageData(user);
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

    const loadStaff = async () => {
      if (!user || !selectedBuildingId) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await listStaffForBuilding(user, selectedBuildingId);
        if (!isMounted) return;
        setStaff(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar el staff.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadStaff();

    return () => {
      isMounted = false;
    };
  }, [selectedBuildingId, user]);

  const filteredStaff = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return staff.filter(
      (staffMember) =>
        staffMember.name.toLowerCase().includes(normalizedTerm) ||
        staffMember.role.toLowerCase().includes(normalizedTerm)
    );
  }, [searchTerm, staff]);

  const canCreateStaff =
    (user?.internalRole === 'ROOT_ADMIN' ||
      user?.internalRole === 'CLIENT_MANAGER' ||
      user?.internalRole === 'BUILDING_ADMIN') &&
    Boolean(selectedBuildingId);

  const actions = (
    <button
      type="button"
      disabled={!canCreateStaff}
      onClick={() => {
        setCreateError(null);
        setCreateName('');
        setCreateEmail('');
        setCreatePassword('');
        setCreatedStaff(null);
        setIsCreateOpen(true);
      }}
      className={`flex items-center px-4 py-2 rounded-xl font-bold text-sm transition-all ${
        canCreateStaff
          ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
      }`}
    >
      <Plus className="w-4 h-4 mr-2" /> Nuevo Staff
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Staff del Edificio" description="Planilla operativa (seguridad, limpieza, conserjeria, etc.)" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {buildings.length > 1 && (
          <BuildingScopeToolbar
            title="Edificio"
            icon={buildingToolbarIcon()}
            buildings={buildings}
            selectedBuildingId={selectedBuildingId}
            searchTerm={searchTerm}
            searchPlaceholder="Buscar por nombre o rol..."
            onBuildingChange={setSelectedBuildingId}
            onSearchChange={setSearchTerm}
          />
        )}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando staff..." />
        ) : !selectedBuildingId ? (
          <EmptyState title="Sin edificio" description="No hay un edificio seleccionado para mostrar su staff." />
        ) : filteredStaff.length === 0 ? (
          <EmptyState title="Sin resultados" description={searchTerm ? `No hay coincidencias para "${searchTerm}".` : 'Aun no hay staff registrado para este edificio.'} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredStaff.map((staffMember) => (
              <StaffCard key={staffMember.id} staffMember={staffMember} />
            ))}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (isCreating) return;
              setIsCreateOpen(false);
              setCreatedStaff(null);
            }}
            type="button"
          />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-slate-900">{createdStaff ? 'Staff creado' : 'Nuevo staff'}</p>
                <p className="mt-1 text-xs text-slate-500 font-medium">
                  {createdStaff
                    ? 'Comparte estas credenciales con el miembro del staff para que pueda iniciar sesión.'
                    : 'Crea un usuario staff y asígnalo al edificio seleccionado.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isCreating) return;
                  setIsCreateOpen(false);
                  setCreatedStaff(null);
                }}
                className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700"
              >
                Cerrar
              </button>
            </div>

            {createdStaff ? (
              <div className="mt-5 space-y-4">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Email</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 truncate">{createEmail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(createEmail)}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 transition-all"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Contraseña temporal</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 truncate">{createdStaff.tempPassword ?? 'Generada por el sistema'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(createdStaff.tempPassword ?? '')}
                      disabled={!createdStaff.tempPassword}
                      className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setCreatedStaff(null);
                    }}
                    className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                  >
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nombre</label>
                    <input
                      value={createName}
                      onChange={(event) => setCreateName(event.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      placeholder="Ej: Juan Pérez"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Email</label>
                    <input
                      value={createEmail}
                      onChange={(event) => setCreateEmail(event.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      placeholder="staff.nuevo@propsys.com"
                      inputMode="email"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Contraseña (opcional)</label>
                    <input
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                      placeholder="Dejar vacío para generar una temporal"
                      type="password"
                    />
                  </div>
                  {createError && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-sm font-bold">{createError}</div>
                  )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCreating) return;
                      setIsCreateOpen(false);
                      setCreatedStaff(null);
                    }}
                    className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={async () => {
                      if (!user) return;
                      if (!selectedBuildingId) {
                        setCreateError('Selecciona un edificio para continuar.');
                        return;
                      }

                      const name = createName.trim();
                      const email = createEmail.trim().toLowerCase();
                      if (!name) {
                        setCreateError('El nombre es requerido.');
                        return;
                      }
                      if (!email || !email.includes('@')) {
                        setCreateError('Ingresa un email válido.');
                        return;
                      }

                      try {
                        setIsCreating(true);
                        setCreateError(null);
                        const created = await createStaffForBuilding(user, {
                          buildingId: selectedBuildingId,
                          name,
                          email,
                          password: createPassword.trim() ? createPassword : undefined,
                        });
                        setStaff((prev) => [created.staff, ...prev]);
                        setCreatedStaff(created);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'No pudimos crear el staff.';
                        setCreateError(msg);
                      } finally {
                        setIsCreating(false);
                      }
                    }}
                    className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
                  >
                    {isCreating ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
