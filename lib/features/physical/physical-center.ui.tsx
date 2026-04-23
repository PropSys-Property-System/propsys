import type { ReactNode } from 'react';
import { Building2, Home, Phone, Search, Users } from 'lucide-react';
import type { Building, CommonArea, StaffMember, Unit } from '@/lib/types';

type BuildingCardProps = {
  building: Building;
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

export function BuildingCard({ building }: BuildingCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{building.name}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium truncate">{building.address}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{building.city}</p>
      </div>
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Building2 className="w-6 h-6 text-primary" />
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
