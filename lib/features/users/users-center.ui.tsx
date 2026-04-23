import { Users } from 'lucide-react';
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
};

export function UserCard({
  currentUser,
  targetUser,
  buildings,
  units,
  pendingUserId,
  onStatusChange,
}: UserCardProps) {
  const canManage = canManageUserLifecycle(currentUser, targetUser);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-900 truncate">{targetUser.name}</p>
        <p className="mt-1 text-xs text-slate-500 font-medium truncate">{targetUser.email}</p>
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

      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
        <Users className="w-6 h-6 text-primary" />
      </div>

      {canManage ? (
        <div className="ml-auto flex-shrink-0 self-center">
          <button
            type="button"
            onClick={() => void onStatusChange(targetUser)}
            disabled={pendingUserId === targetUser.id}
            className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition ${
              targetUser.status === 'ACTIVE'
                ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {pendingUserId === targetUser.id ? 'Guardando...' : targetUser.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
          </button>
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
