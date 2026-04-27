import type { ReactNode } from 'react';
import { Building2, Home, Phone, Search, Users } from 'lucide-react';
import type { Building, CommonArea, StaffMember, Unit } from '@/lib/types';
import { labelClient } from '@/lib/presentation/labels';

type BuildingCardProps = {
  building: Building;
  showClient?: boolean;
  canArchive?: boolean;
  isArchiving?: boolean;
  onArchive?: (building: Building) => void | Promise<void>;
  canRestore?: boolean;
  isRestoring?: boolean;
  onRestore?: (building: Building) => void | Promise<void>;
  canManageUnits?: boolean;
  onManageUnits?: (building: Building) => void | Promise<void>;
};

type BuildingComposerDialogProps = {
  isOpen: boolean;
  canChooseClient: boolean;
  clientOptions: Array<{ id: string; label?: string }>;
  selectedClientId: string;
  name: string;
  address: string;
  city: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onClientChange: (clientId: string) => void;
  onNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

type BuildingUnitsDialogProps = {
  isOpen: boolean;
  building: Building | null;
  units: Unit[];
  number: string;
  floor: string;
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  canCreate: boolean;
  onClose: () => void;
  onNumberChange: (value: string) => void;
  onFloorChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
};

type BuildingScopeToolbarProps = {
  title: string;
  icon: ReactNode;
  buildings: Building[];
  selectedBuildingId: string;
  searchTerm: string;
  searchPlaceholder: string;
  onBuildingChange: (buildingId: string) => void;
  onSearchChange: (searchTerm: string) => void;
};

type CommonAreaCardProps = {
  area: CommonArea;
  canManageApproval: boolean;
  savingAreaId: string | null;
  onToggleApproval: (area: CommonArea, nextRequiresApproval: boolean) => void | Promise<void>;
};

type StaffCardProps = {
  staffMember: StaffMember;
};

type ResidentUnitCardProps = {
  unit: Unit;
  buildingName?: string;
};

export function BuildingCard({
  building,
  showClient = false,
  canArchive = false,
  isArchiving = false,
  onArchive,
  canRestore = false,
  isRestoring = false,
  onRestore,
  canManageUnits = false,
  onManageUnits,
}: BuildingCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        {showClient && building.clientId ? (
          <span className="mb-3 inline-flex max-w-full px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest truncate">
            {labelClient(building.clientId)}
          </span>
        ) : null}
        <p className="text-sm font-black text-slate-900 truncate">{building.name}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium truncate">{building.address}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{building.city}</p>
        {canManageUnits && onManageUnits ? (
          <button
            type="button"
            onClick={() => void onManageUnits(building)}
            className="mt-4 mr-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-50 transition-all"
          >
            Ver unidades
          </button>
        ) : null}
        {canArchive && onArchive ? (
          <button
            type="button"
            disabled={isArchiving}
            onClick={() => void onArchive(building)}
            className="mt-4 px-3 py-2 rounded-xl bg-white border border-rose-100 text-rose-700 font-black text-xs hover:bg-rose-50 transition-all disabled:opacity-60"
          >
            {isArchiving ? 'Archivando...' : 'Archivar'}
          </button>
        ) : null}
        {canRestore && onRestore ? (
          <button
            type="button"
            disabled={isRestoring}
            onClick={() => void onRestore(building)}
            className="mt-4 px-3 py-2 rounded-xl bg-white border border-emerald-100 text-emerald-700 font-black text-xs hover:bg-emerald-50 transition-all disabled:opacity-60"
          >
            {isRestoring ? 'Restaurando...' : 'Restaurar'}
          </button>
        ) : null}
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Building2 className="w-6 h-6 text-primary" />
      </div>
    </div>
  );
}

export function BuildingUnitsDialog({
  isOpen,
  building,
  units,
  number,
  floor,
  error,
  isLoading,
  isSubmitting,
  canCreate,
  onClose,
  onNumberChange,
  onFloorChange,
  onSubmit,
}: BuildingUnitsDialogProps) {
  if (!isOpen || !building) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" type="button" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-black text-slate-900 truncate">Unidades</p>
            <p className="mt-1 text-xs text-slate-500 font-medium truncate">{building.name}</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        {error ? <div className="mt-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-sm font-bold">{error}</div> : null}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[45vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="md:col-span-2 text-sm font-bold text-slate-500">Cargando unidades...</div>
          ) : units.length === 0 ? (
            <div className="md:col-span-2 bg-slate-50 border border-slate-100 rounded-2xl p-5 text-sm font-bold text-slate-500">
              Este edificio aun no tiene unidades registradas.
            </div>
          ) : (
            units.map((unit) => (
              <div key={unit.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-sm font-black text-slate-900">Depto {unit.number}</p>
                <p className="mt-1 text-xs text-slate-500 font-bold">Piso {unit.floor || '-'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    {unit.ownerId ? 'Con propietario' : 'Sin propietario'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest">
                    {unit.residentId ? 'Con inquilino' : 'Sin inquilino'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {canCreate ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Nueva unidad</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
              <input
                value={number}
                onChange={(event) => onNumberChange(event.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                placeholder="Numero, ej: 101"
              />
              <input
                value={floor}
                onChange={(event) => onFloorChange(event.target.value)}
                className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
                placeholder="Piso, ej: 1"
              />
              <button
                type="button"
                onClick={() => void onSubmit()}
                disabled={isSubmitting}
                className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
              >
                {isSubmitting ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function BuildingComposerDialog({
  isOpen,
  canChooseClient,
  clientOptions,
  selectedClientId,
  name,
  address,
  city,
  error,
  isSubmitting,
  onClose,
  onClientChange,
  onNameChange,
  onAddressChange,
  onCityChange,
  onSubmit,
}: BuildingComposerDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" type="button" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black text-slate-900">Nuevo edificio</p>
            <p className="mt-1 text-xs text-slate-500 font-medium">Registra un edificio dentro del portafolio activo.</p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-black text-slate-500 hover:text-slate-700">
            Cerrar
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {canChooseClient && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Cliente</label>
              <select
                value={selectedClientId}
                onChange={(event) => onClientChange(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              >
                <option value="">Selecciona un cliente...</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.label ?? labelClient(client.id)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Nombre</label>
            <input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              placeholder="Ej: Torre Los Álamos"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Dirección</label>
            <input
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              placeholder="Ej: Av. Principal 123"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Ciudad</label>
            <input
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
              placeholder="Ej: Lima"
            />
          </div>
          {error ? <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl px-4 py-3 text-sm font-bold">{error}</div> : null}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-sm hover:bg-slate-50 transition-all disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={isSubmitting}
            className="px-5 py-3 rounded-xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-70"
          >
            {isSubmitting ? 'Guardando...' : 'Crear edificio'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BuildingScopeToolbar({
  title,
  icon,
  buildings,
  selectedBuildingId,
  searchTerm,
  searchPlaceholder,
  onBuildingChange,
  onSearchChange,
}: BuildingScopeToolbarProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center">
      <div className="flex items-center text-sm font-bold text-slate-700">
        {icon} {title}
      </div>
      <select
        value={selectedBuildingId}
        onChange={(event) => onBuildingChange(event.target.value)}
        className="w-full md:w-80 px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
      >
        {buildings.map((building) => (
          <option key={building.id} value={building.id}>
            {building.name}
          </option>
        ))}
      </select>
      <div className="relative flex-1 group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
        />
      </div>
    </div>
  );
}

export function CommonAreaCard({ area, canManageApproval, savingAreaId, onToggleApproval }: CommonAreaCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <p className="text-sm font-black text-slate-900">{area.name}</p>
      <p className="text-xs text-slate-500 font-medium mt-1">
        {typeof area.capacity === 'number' ? `Capacidad ${area.capacity}` : 'Capacidad no definida'}
      </p>
      <div className="mt-4">
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            area.requiresApproval ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {area.requiresApproval ? 'Requiere aprobacion' : 'Auto-aprobacion'}
        </span>
      </div>
      {canManageApproval && (
        <button
          type="button"
          disabled={savingAreaId === area.id}
          onClick={() => void onToggleApproval(area, !area.requiresApproval)}
          className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all disabled:opacity-60"
        >
          {savingAreaId === area.id
            ? 'Guardando...'
            : area.requiresApproval
              ? 'Cambiar a auto-aprobacion'
              : 'Requerir aprobacion'}
        </button>
      )}
    </div>
  );
}

export function StaffCard({ staffMember }: StaffCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{staffMember.name}</p>
        <p className="text-xs text-slate-500 font-bold mt-1">{staffMember.role}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {staffMember.shift && (
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
              Turno {staffMember.shift}
            </span>
          )}
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              staffMember.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {staffMember.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      </div>

      {staffMember.phone ? (
        <a
          href={`tel:${staffMember.phone}`}
          className="flex items-center px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-black text-slate-600 hover:border-slate-200 transition-all"
        >
          <Phone className="w-4 h-4 mr-2 text-primary" /> Llamar
        </a>
      ) : (
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Users className="w-6 h-6 text-primary" />
        </div>
      )}
    </div>
  );
}

export function ResidentUnitCard({ unit, buildingName }: ResidentUnitCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900 truncate">Depto {unit.number}</p>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {buildingName ?? 'Edificio'} - Piso {unit.floor ?? '-'}
          </p>
        </div>
        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Home className="w-6 h-6 text-primary" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
          {unit.residentId ? 'Con inquilino' : 'Sin inquilino'}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center">
          <Building2 className="w-3.5 h-3.5 mr-1.5" /> Unidad {unit.id}
        </span>
      </div>
    </div>
  );
}

export function buildingToolbarIcon() {
  return <Home className="w-4 h-4 mr-2 text-primary" />;
}
