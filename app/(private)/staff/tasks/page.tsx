'use client';

import React, { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/States';
import { ClipboardList, CheckCircle2, Circle, Search } from 'lucide-react';

type TaskStatus = 'PENDING' | 'DONE';

interface TaskItem {
  id: string;
  title: string;
  location?: string;
  status: TaskStatus;
}

const MOCK_TASKS: TaskItem[] = [
  { id: 'task-1', title: 'Ronda de seguridad (turno noche)', location: 'Hall principal', status: 'PENDING' },
  { id: 'task-2', title: 'Revisión luminarias pasillo', location: 'Piso 1', status: 'PENDING' },
  { id: 'task-3', title: 'Limpieza sala multiuso', location: 'Piso 0', status: 'DONE' },
];

export default function StaffTasksPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const tasks = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return MOCK_TASKS.filter((x) => x.title.toLowerCase().includes(t) || (x.location ?? '').toLowerCase().includes(t));
  }, [searchTerm]);

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

        {tasks.length === 0 ? (
          <EmptyState title="Sin tareas" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay tareas asignadas para este turno.'} />
        ) : (
          <div className="space-y-3 max-w-3xl">
            {tasks.map((task) => (
              <div key={task.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{task.title}</p>
                  {task.location && <p className="mt-1 text-xs text-slate-500 font-medium">{task.location}</p>}
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {task.status === 'DONE' ? 'Completada' : 'Pendiente'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/10">
                  {task.status === 'DONE' ? (
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

