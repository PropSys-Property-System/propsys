'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Megaphone, Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { noticesRepo } from '@/lib/data';
import { Notice } from '@/lib/types';
import { labelNoticeAudience } from '@/lib/presentation/labels';

export default function ResidentNoticesPage() {
  const { user } = useAuth();
  const [allNotices, setAllNotices] = useState<Notice[]>([]);
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
        const data = await noticesRepo.listForUser(user);
        if (!isMounted) return;
        setAllNotices(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los avisos.');
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

  const notices = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return allNotices
      .filter((n) => n.title.toLowerCase().includes(t) || n.body.toLowerCase().includes(t))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotices, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Avisos" description="Comunicados oficiales de tu edificio y de PropSys" />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar avisos..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando avisos..." />
        ) : notices.length === 0 ? (
          <EmptyState title="Sin avisos" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'Aún no hay avisos publicados.'} />
        ) : (
          <div className="space-y-3 max-w-4xl">
            {notices.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200 rounded-2xl p-6 flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">
                      {n.audience === 'ALL_BUILDINGS' ? 'PropSys' : labelNoticeAudience(n.audience)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      {new Date(n.createdAt).toLocaleString('es-CL')}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-black text-slate-900">{n.title}</p>
                  <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">{n.body}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-6 h-6 text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

