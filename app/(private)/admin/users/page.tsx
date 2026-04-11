'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Search, UserPlus, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { buildingsRepo, unitsRepo, usersRepo } from '@/lib/data';
import { Building, Unit, User } from '@/lib/types';
import { labelUserRole } from '@/lib/presentation/labels';

export default function UsersPage() {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const [data, b, u] = await Promise.all([usersRepo.listForUser(user), buildingsRepo.listForUser(user), unitsRepo.listForUser(user)]);
        if (!isMounted) return;
        setAllUsers(data);
        setBuildings(b);
        setUnits(u);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los usuarios.');
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

  const buildingNameById = useMemo(() => new Map(buildings.map((b) => [b.id, b.name])), [buildings]);
  const unitLabelById = useMemo(() => new Map(units.map((u) => [u.id, `Depto ${u.number}`])), [units]);

  const users = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allUsers.filter((u) => {
      const roleLabel = labelUserRole(u.role).toLowerCase();
      const buildingName = u.buildingId ? buildingNameById.get(u.buildingId)?.toLowerCase() ?? '' : '';
      const unitLabel = u.unitId ? unitLabelById.get(u.unitId)?.toLowerCase() ?? '' : '';
      return (
        u.name.toLowerCase().includes(t) ||
        u.email.toLowerCase().includes(t) ||
        roleLabel.includes(t) ||
        buildingName.includes(t) ||
        unitLabel.includes(t)
      );
    });
  }, [allUsers, searchTerm, buildingNameById, unitLabelById]);

  const actions = (
    <button disabled className="flex items-center px-4 py-2 bg-slate-100 text-slate-400 rounded-xl font-bold text-sm cursor-not-allowed">
      <UserPlus className="w-4 h-4 mr-2" /> Próximamente
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Gestión de Usuarios" 
        description="Administra los roles y accesos de PropSys"
        actions={actions}
      />
      
      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, email o rol..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando usuarios..." />
        ) : users.length === 0 ? (
          <EmptyState title="Sin usuarios" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay usuarios disponibles.'} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
            {users.map((u) => (
              <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{u.name}</p>
                  <p className="mt-1 text-xs text-slate-500 font-medium truncate">{u.email}</p>
                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {labelUserRole(u.role)}
                    </span>
                    {u.buildingId && buildingNameById.get(u.buildingId) && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        {buildingNameById.get(u.buildingId)}
                      </span>
                    )}
                    {u.unitId && unitLabelById.get(u.unitId) && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        {unitLabelById.get(u.unitId)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

