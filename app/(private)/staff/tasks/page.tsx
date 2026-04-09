'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ClipboardList, CheckCircle2, Circle, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { tasksRepo } from '@/lib/data';
import { TaskEntity } from '@/lib/types';

export default function StaffTasksPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allTasks, setAllTasks] = useState<TaskEntity[]>([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await tasksRepo.listForUser(user);
        if (!isMounted) return;
        setAllTasks(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar tus tareas.');
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

  const tasks = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allTasks.filter((x) => x.title.toLowerCase().includes(t) || (x.description ?? '').toLowerCase().includes(t));
  }, [searchTerm, allTasks]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Mis Tareas" description="Checklist operativo para tu turno en PropSys" />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar tareas..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando tareas..." />
        ) : tasks.length === 0 ? (
          <EmptyState title="Sin tareas" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay tareas asignadas para este turno.'} />
        ) : (
          <div className="space-y-3 max-w-3xl">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{task.title}</p>
                  {task.description && <p className="mt-1 text-xs text-slate-500 font-medium">{task.description}</p>}
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {task.status === 'APPROVED'
                      ? 'Aprobada'
                      : task.status === 'COMPLETED'
                        ? 'Completada'
                        : task.status === 'IN_PROGRESS'
                          ? 'En progreso'
                          : 'Pendiente'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                  {task.status === 'COMPLETED' || task.status === 'APPROVED' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <Circle className="w-6 h-6 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center py-4">
          <div className="flex items-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            <ClipboardList className="w-4 h-4 mr-2" /> PropSys Staff
          </div>
        </div>
      </div>
    </div>
  );
}

