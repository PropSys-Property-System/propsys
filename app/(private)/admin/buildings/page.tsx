'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  archiveBuildingForUser,
  assignUserToUnit,
  createUnitForBuilding,
  createBuildingForUser,
  listUnitsForBuilding,
  loadAdminBuildingsPageData,
  restoreBuildingForUser,
  unassignUnitResident,
} from '@/lib/features/physical/physical-center.data';
import { BuildingCard, BuildingComposerDialog, BuildingUnitsDialog } from '@/lib/features/physical/physical-center.ui';
import type { Building, Unit } from '@/lib/types';
import { labelClient } from '@/lib/presentation/labels';

type UnitAssignmentType = 'OWNER' | 'OCCUPANT';

export default function BuildingsPage() {
  const { user } = useAuth();
  const [allBuildings, setAllBuildings] = useState<Building[]>([]);
  const [archivedBuildings, setArchivedBuildings] = useState<Building[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilterId, setClientFilterId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createClientId, setCreateClientId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [createCity, setCreateCity] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingBuildingId, setArchivingBuildingId] = useState<string | null>(null);
  const [restoringBuildingId, setRestoringBuildingId] = useState<string | null>(null);
  const [unitBuilding, setUnitBuilding] = useState<Building | null>(null);
  const [buildingUnits, setBuildingUnits] = useState<Unit[]>([]);
  const [isUnitsLoading, setIsUnitsLoading] = useState(false);
  const [unitNumber, setUnitNumber] = useState('');
  const [unitFloor, setUnitFloor] = useState('');
  const [unitError, setUnitError] = useState<string | null>(null);
  const [isUnitSubmitting, setIsUnitSubmitting] = useState(false);
  const [assigningUnit, setAssigningUnit] = useState<Unit | null>(null);
  const [assignmentType, setAssignmentType] = useState<UnitAssignmentType | null>(null);
  const [assignmentName, setAssignmentName] = useState('');
  const [assignmentEmail, setAssignmentEmail] = useState('');
  const [assignmentPassword, setAssignmentPassword] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [isAssignmentSubmitting, setIsAssignmentSubmitting] = useState(false);
  const [isResidentUnassigning, setIsResidentUnassigning] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        setError(null);
        const data = await loadAdminBuildingsPageData(user);
        if (!isMounted) return;
        setAllBuildings(data.buildings);
        setArchivedBuildings(data.archivedBuildings);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los edificios.');
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

  const buildings = useMemo(() => {
    const sourceBuildings = showArchived ? archivedBuildings : allBuildings;
    const normalizedTerm = searchTerm.trim().toLowerCase();
    return sourceBuildings.filter(
      (building) =>
        (!clientFilterId || building.clientId === clientFilterId) &&
        (!normalizedTerm ||
          building.name.toLowerCase().includes(normalizedTerm) ||
          building.address.toLowerCase().includes(normalizedTerm) ||
          building.city.toLowerCase().includes(normalizedTerm))
    );
  }, [allBuildings, archivedBuildings, clientFilterId, searchTerm, showArchived]);

  const clientOptions = useMemo(() => {
    const byClientId = new Map<string, { id: string; label: string }>();
    for (const building of [...allBuildings, ...archivedBuildings]) {
      if (!building.clientId || byClientId.has(building.clientId)) continue;
      byClientId.set(building.clientId, {
        id: building.clientId,
        label: labelClient(building.clientId),
      });
    }
    return Array.from(byClientId.values());
  }, [allBuildings, archivedBuildings]);

  const canCreate = user?.internalRole === 'ROOT_ADMIN' || user?.internalRole === 'CLIENT_MANAGER';
  const canArchive = canCreate;
  const canManageUnits = canCreate;
  const canFilterClients = user?.internalRole === 'ROOT_ADMIN' && clientOptions.length > 1;

  const actions = (
    <button
      type="button"
      disabled={!canCreate}
      onClick={() => {
        if (!canCreate) return;
        setCreateError(null);
        setCreateName('');
        setCreateAddress('');
        setCreateCity('');
        setCreateClientId(user?.internalRole === 'ROOT_ADMIN' ? '' : user?.clientId ?? '');
        setIsCreateOpen(true);
      }}
      className={`flex items-center px-4 py-2 rounded-xl font-bold text-sm transition-all ${
        canCreate
          ? 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90'
          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
      }`}
    >
      <Plus className="w-4 h-4 mr-2" /> Nuevo edificio
    </button>
  );

  async function handleCreateBuilding() {
    if (!user) return;

    if (user.internalRole === 'ROOT_ADMIN' && !createClientId) {
      setCreateError('Selecciona un cliente.');
      return;
    }
    if (!createName.trim() || !createAddress.trim() || !createCity.trim()) {
      setCreateError('Completa nombre, dirección y ciudad.');
      return;
    }

    const targetClientId = user.internalRole === 'ROOT_ADMIN' ? createClientId : user.clientId;
    const normalizedName = createName.trim().toLowerCase();
    const duplicateBuilding = allBuildings.some(
      (building) => building.clientId === targetClientId && building.name.trim().toLowerCase() === normalizedName
    );
    if (duplicateBuilding) {
      setCreateError('Ya existe un edificio con ese nombre para este cliente.');
      return;
    }

    try {
      setIsSubmitting(true);
      setCreateError(null);
      const created = await createBuildingForUser(user, {
        clientId: user.internalRole === 'ROOT_ADMIN' ? createClientId : undefined,
        name: createName.trim(),
        address: createAddress.trim(),
        city: createCity.trim(),
      });
      setAllBuildings((current) => [created, ...current]);
      if (user.internalRole === 'ROOT_ADMIN') setClientFilterId(created.clientId ?? '');
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No pudimos crear el edificio.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchiveBuilding(building: Building) {
    if (!user || !canArchive) return;

    const confirmed = window.confirm(`Archivar "${building.name}" lo quitara de los listados activos. Esta accion no borra datos historicos.`);
    if (!confirmed) return;

    try {
      setError(null);
      setArchivingBuildingId(building.id);
      const archived = await archiveBuildingForUser(user, building.id);
      setAllBuildings((current) => current.filter((item) => item.id !== building.id));
      setArchivedBuildings((current) => [archived, ...current]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos archivar el edificio.');
    } finally {
      setArchivingBuildingId(null);
    }
  }

  async function handleRestoreBuilding(building: Building) {
    if (!user || !canArchive) return;

    const confirmed = window.confirm(`Restaurar "${building.name}" lo devolvera a los listados activos.`);
    if (!confirmed) return;

    try {
      setError(null);
      setRestoringBuildingId(building.id);
      const restored = await restoreBuildingForUser(user, building.id);
      setArchivedBuildings((current) => current.filter((item) => item.id !== building.id));
      setAllBuildings((current) => [restored, ...current]);
      if (user.internalRole === 'ROOT_ADMIN') setClientFilterId(restored.clientId ?? '');
      setShowArchived(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos restaurar el edificio.');
    } finally {
      setRestoringBuildingId(null);
    }
  }

  async function handleOpenUnits(building: Building) {
    if (!user) return;

    setUnitBuilding(building);
    setBuildingUnits([]);
    setUnitNumber('');
    setUnitFloor('');
    setUnitError(null);
    setAssigningUnit(null);
    setAssignmentType(null);
    setAssignmentName('');
    setAssignmentEmail('');
    setAssignmentPassword('');
    setAssignmentMessage(null);

    try {
      setIsUnitsLoading(true);
      const units = await listUnitsForBuilding(user, building.id);
      setBuildingUnits(units);
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'No pudimos cargar las unidades.');
    } finally {
      setIsUnitsLoading(false);
    }
  }

  async function handleCreateUnit() {
    if (!user || !unitBuilding) return;
    if (!unitNumber.trim()) {
      setUnitError('Ingresa el numero de unidad.');
      return;
    }

    const duplicateUnit = buildingUnits.some((unit) => unit.number.trim().toLowerCase() === unitNumber.trim().toLowerCase());
    if (duplicateUnit) {
      setUnitError('Ya existe una unidad con ese numero en este edificio.');
      return;
    }

    try {
      setIsUnitSubmitting(true);
      setUnitError(null);
      const created = await createUnitForBuilding(user, {
        buildingId: unitBuilding.id,
        number: unitNumber.trim(),
        floor: unitFloor.trim(),
      });
      setBuildingUnits((current) => [created, ...current]);
      setUnitNumber('');
      setUnitFloor('');
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'No pudimos crear la unidad.');
    } finally {
      setIsUnitSubmitting(false);
    }
  }

  function handleStartUnitAssignment(unit: Unit, nextAssignmentType: UnitAssignmentType) {
    setAssigningUnit(unit);
    setAssignmentType(nextAssignmentType);
    setAssignmentName('');
    setAssignmentEmail('');
    setAssignmentPassword('');
    setAssignmentMessage(null);
    setUnitError(null);
  }

  function handleCancelUnitAssignment() {
    setAssigningUnit(null);
    setAssignmentType(null);
    setAssignmentName('');
    setAssignmentEmail('');
    setAssignmentPassword('');
  }

  async function handleAssignUserToUnit() {
    if (!user || !assigningUnit || !assignmentType) return;

    if (!assignmentName.trim() || !assignmentEmail.trim()) {
      setUnitError('Completa nombre y email para asignar el usuario.');
      return;
    }

    try {
      setIsAssignmentSubmitting(true);
      setUnitError(null);
      setAssignmentMessage(null);

      const result = await assignUserToUnit(user, {
        unitId: assigningUnit.id,
        assignmentType,
        name: assignmentName.trim(),
        email: assignmentEmail.trim(),
        password: assignmentPassword.trim() || undefined,
      });

      setBuildingUnits((current) =>
        current.map((unit) =>
          unit.id === result.unitId
            ? {
                ...unit,
                ownerId: result.assignmentType === 'OWNER' ? result.user.id : unit.ownerId,
                residentId: result.assignmentType === 'OCCUPANT' ? result.user.id : unit.residentId,
              }
            : unit
        )
      );
      setAssignmentMessage(
        result.tempPassword
          ? `Usuario creado y asignado. Contrasena temporal: ${result.tempPassword}`
          : 'Usuario existente asignado correctamente.'
      );
      handleCancelUnitAssignment();
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'No pudimos asignar el usuario a la unidad.');
    } finally {
      setIsAssignmentSubmitting(false);
    }
  }

  async function handleAssignOwnerAsResident(unit: Unit) {
    if (!user || !unit.ownerId) return;

    try {
      setIsAssignmentSubmitting(true);
      setUnitError(null);
      setAssignmentMessage(null);

      const result = await assignUserToUnit(user, {
        unitId: unit.id,
        assignmentType: 'OCCUPANT',
        ownerAsResident: true,
      });

      setBuildingUnits((current) =>
        current.map((item) =>
          item.id === result.unitId
            ? {
                ...item,
                residentId: result.user.id,
              }
            : item
        )
      );
      setAssignmentMessage('Propietario marcado como residente de la unidad.');
      handleCancelUnitAssignment();
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'No pudimos marcar al propietario como residente.');
    } finally {
      setIsAssignmentSubmitting(false);
    }
  }

  async function handleUnassignResident(unit: Unit) {
    if (!user || !unit.residentId) return;

    const confirmed = window.confirm('Liberar la residencia de esta unidad permitira asignar un nuevo inquilino o marcar al propietario como residente.');
    if (!confirmed) return;

    try {
      setIsResidentUnassigning(true);
      setUnitError(null);
      setAssignmentMessage(null);

      const result = await unassignUnitResident(user, { unitId: unit.id });
      setBuildingUnits((current) =>
        current.map((item) =>
          item.id === result.unitId
            ? {
                ...item,
                residentId: undefined,
              }
            : item
        )
      );
      setAssignmentMessage('Residencia liberada. Ahora puedes asignar un inquilino nuevo o marcar al propietario como residente.');
      handleCancelUnitAssignment();
    } catch (err) {
      setUnitError(err instanceof Error ? err.message : 'No pudimos liberar la residencia.');
    } finally {
      setIsResidentUnassigning(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Gestion de Edificios" description="Administra el portafolio de edificios de PropSys" actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        {canArchive ? (
          <div className="inline-flex p-1 bg-white border border-slate-200 rounded-2xl">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                !showArchived ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Activos ({allBuildings.length})
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                showArchived ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Archivados ({archivedBuildings.length})
            </button>
          </div>
        ) : null}

        <div className="flex flex-col md:flex-row gap-3 max-w-5xl">
          {canFilterClients ? (
            <select
              value={clientFilterId}
              onChange={(event) => setClientFilterId(event.target.value)}
              className="w-full md:w-72 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-bold text-slate-700"
            >
              <option value="">Todos los clientes</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.label}
                </option>
              ))}
            </select>
          ) : null}
          <div className="relative group flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, direccion o ciudad..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando edificios..." />
        ) : buildings.length === 0 ? (
          <EmptyState
            title={showArchived ? 'Sin edificios archivados' : 'Sin edificios'}
            description={
              searchTerm
                ? `No hay resultados para "${searchTerm}".`
                : showArchived
                  ? 'No hay edificios archivados en este alcance.'
                  : 'Aun no tienes edificios registrados en PropSys.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl">
            {buildings.map((building) => (
              <BuildingCard
                key={building.id}
                building={building}
                showClient={user?.internalRole === 'ROOT_ADMIN'}
                canArchive={canArchive && !showArchived}
                isArchiving={archivingBuildingId === building.id}
                onArchive={handleArchiveBuilding}
                canRestore={canArchive && showArchived}
                isRestoring={restoringBuildingId === building.id}
                onRestore={handleRestoreBuilding}
                canManageUnits={canManageUnits && !showArchived}
                onManageUnits={handleOpenUnits}
              />
            ))}
          </div>
        )}
      </div>

      <BuildingComposerDialog
        isOpen={isCreateOpen}
        canChooseClient={user?.internalRole === 'ROOT_ADMIN'}
        clientOptions={clientOptions}
        selectedClientId={createClientId}
        name={createName}
        address={createAddress}
        city={createCity}
        error={createError}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (isSubmitting) return;
          setIsCreateOpen(false);
        }}
        onClientChange={setCreateClientId}
        onNameChange={setCreateName}
        onAddressChange={setCreateAddress}
        onCityChange={setCreateCity}
        onSubmit={handleCreateBuilding}
      />

      <BuildingUnitsDialog
        isOpen={Boolean(unitBuilding)}
        building={unitBuilding}
        units={buildingUnits}
        number={unitNumber}
        floor={unitFloor}
        error={unitError}
        isLoading={isUnitsLoading}
        isSubmitting={isUnitSubmitting}
        canCreate={canManageUnits}
        onClose={() => {
          if (isUnitSubmitting || isAssignmentSubmitting || isResidentUnassigning) return;
          setUnitBuilding(null);
          handleCancelUnitAssignment();
          setAssignmentMessage(null);
        }}
        onNumberChange={setUnitNumber}
        onFloorChange={setUnitFloor}
        onSubmit={handleCreateUnit}
        assigningUnit={assigningUnit}
        assignmentType={assignmentType}
        assignmentName={assignmentName}
        assignmentEmail={assignmentEmail}
        assignmentPassword={assignmentPassword}
        assignmentMessage={assignmentMessage}
        isAssigning={isAssignmentSubmitting}
        isUnassigningResident={isResidentUnassigning}
        onStartAssignment={handleStartUnitAssignment}
        onCancelAssignment={handleCancelUnitAssignment}
        onAssignmentNameChange={setAssignmentName}
        onAssignmentEmailChange={setAssignmentEmail}
        onAssignmentPasswordChange={setAssignmentPassword}
        onAssignUser={handleAssignUserToUnit}
        onAssignOwnerAsResident={handleAssignOwnerAsResident}
        onUnassignResident={handleUnassignResident}
      />
    </div>
  );
}
