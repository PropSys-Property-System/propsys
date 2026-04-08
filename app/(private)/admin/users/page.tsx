'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from "@/components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { Search, UserPlus, Users } from 'lucide-react';
import { RouteGuard } from '@/lib/auth/route-guard';
import { useAuth } from '@/lib/auth/auth-context';
import { usersRepo } from '@/lib/data';
import { User } from '@/lib/types';

export default function UsersPage() {
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
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
        const data = await usersRepo.listForUser(user);
        if (!isMounted) return;
        setAllUsers(data);
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

  const users = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allUsers.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t) || u.role.toLowerCase().includes(t));
  }, [allUsers, searchTerm]);

  const actions = (
    <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
      <UserPlus className="w-4 h-4 mr-2" /> Nuevo Usuario
    </button>
  );

  return (
    <RouteGuard allowedRoles={['MANAGER']}>
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
                        {u.role}
                      </span>
                      {u.buildingId && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                          Edificio {u.buildingId}
                        </span>
                      )}
                      {u.unitId && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                          Unidad {u.unitId}
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
    </RouteGuard>
  );
}
