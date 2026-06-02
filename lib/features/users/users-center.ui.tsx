import { useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { canManageUserLifecycle } from '@/lib/auth/access-rules';
import { labelUserRole, labelUserStatus } from '@/lib/presentation/labels';
import type { Building, Unit, User } from '@/lib/types';

type UserCardProps = {
  currentUser: User;
  targetUser: User;
  buildings: Map<string, string>;
  units: Map<string, string>;
  pendingUserId: string | null;
  onStatusChange: (target: User) => void | Promise<void>;
  onEdit?: (target: User) => void;
};

export function UserCard({
  currentUser,
  targetUser,
  buildings,
  units,
  pendingUserId,
  onStatusChange,
  onEdit,
}: UserCardProps) {
  const canManage = canManageUserLifecycle(currentUser, targetUser);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const isPending = pendingUserId === targetUser.id;
  const statusActionLabel = isPending ? 'Guardando...' : targetUser.status === 'ACTIVE' ? 'Suspender' : 'Reactivar';

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:gap-6 sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-black text-slate-900 sm:truncate">{targetUser.name}</p>
        <p className="mt-1 break-all text-xs font-medium text-slate-500 sm:truncate">{targetUser.email}</p>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
            {labelUserRole(targetUser.role)}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              targetUser.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700'
                : targetUser.status === 'SUSPENDED'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {labelUserStatus(targetUser.status)}
          </span>
          {targetUser.buildingId && buildings.get(targetUser.buildingId) && (
            <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              {buildings.get(targetUser.buildingId)}
            </span>
          )}
          {targetUser.unitId && units.get(targetUser.unitId) && (
            <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              {units.get(targetUser.unitId)}
            </span>
          )}
        </div>
      </div>

      <div className="hidden h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 md:flex">
        <Users className="w-6 h-6 text-primary" />
      </div>

      {canManage ? (
        <div data-testid="desktop-user-actions" className="ml-auto hidden flex-shrink-0 self-center items-center gap-2 md:flex">
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(targetUser)}
              disabled={isPending}
              className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Editar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void onStatusChange(targetUser)}
            disabled={isPending}
            className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition ${
              targetUser.status === 'ACTIVE'
                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {statusActionLabel}
          </button>
        </div>
      ) : null}

      {canManage ? (
        <div
          className="relative ml-auto flex-shrink-0 md:hidden"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsMobileActionsOpen(false);
          }}
        >
          <button
            type="button"
            aria-label={`Acciones para ${targetUser.name}`}
            aria-haspopup="menu"
            aria-expanded={isMobileActionsOpen}
            onClick={() => setIsMobileActionsOpen((current) => !current)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100 md:hidden"
          >
            Acciones
            <ChevronDown className="h-4 w-4" />
          </button>
          {isMobileActionsOpen ? (
            <div
              role="menu"
              aria-label={`Acciones para ${targetUser.name}`}
              className="absolute right-0 top-full z-10 mt-2 min-w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
            >
              {onEdit ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={isPending}
                  onClick={() => {
                    setIsMobileActionsOpen(false);
                    onEdit(targetUser);
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Editar
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={isPending}
                onClick={() => {
                  setIsMobileActionsOpen(false);
                  void onStatusChange(targetUser);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {statusActionLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function buildBuildingNameMap(buildings: Building[]) {
  return new Map(buildings.map((building) => [building.id, building.name]));
}

export function buildUnitLabelMap(units: Unit[]) {
  return new Map(units.map((unit) => [unit.id, `Depto ${unit.number}`]));
}
