'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { Search } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { loadResidentNoticesPageData } from '@/lib/features/notices/notices-center.data';
import { ResidentNoticeCard } from '@/lib/features/notices/notices-center.ui';
import { Notice } from '@/lib/types';

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
        const data = await loadResidentNoticesPageData(user);
        if (!isMounted) return;
        setAllNotices(data.notices);
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
              <ResidentNoticeCard key={n.id} notice={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


