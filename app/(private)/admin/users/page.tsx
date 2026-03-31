'use client';

import React from 'react';
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/States";
import { UserPlus } from 'lucide-react';

export default function UsersPage() {
  const actions = (
    <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
      <UserPlus className="w-4 h-4 mr-2" /> Nuevo Usuario
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Gestión de Usuarios" 
        description="Administra los roles y accesos de PropSys"
        actions={actions}
      />
      
      <div className="p-6 md:p-8">
        <EmptyState 
          title="Próximamente" 
          description="Estamos preparando el panel de control de usuarios para ti."
        />
      </div>
    </div>
  );
}
