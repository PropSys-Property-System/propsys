import React from 'react';
import { Edit2, Ban, CheckCircle2 } from 'lucide-react';
import type { ClientAccount } from '@/lib/repos/core/clients.repo';

type ClientCardProps = {
  client: ClientAccount;
  pendingClientId: string | null;
  onStatusChange: (client: ClientAccount) => void;
  onEdit: (client: ClientAccount) => void;
};

export function ClientCard({ client, pendingClientId, onStatusChange, onEdit }: ClientCardProps) {
  const isSuspended = client.status === 'SUSPENDED';
  const isPending = pendingClientId === client.id;

  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all ${isSuspended ? 'border-red-100 bg-red-50/30' : 'border-slate-200 bg-white hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-base font-black ${isSuspended ? 'text-slate-500' : 'text-slate-900'}`}>{client.name}</h3>
            {isSuspended && (
              <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700">
                <Ban className="mr-1 h-3 w-3" />
                SUSPENDIDO
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-slate-500">ID: {client.id}</p>
        </div>

        <div className="flex items-center gap-1 opacity-100 transition-opacity">
          {!isSuspended && (
            <button
              type="button"
              onClick={() => onEdit(client)}
              disabled={isPending}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary disabled:opacity-50"
              title="Editar cliente"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onStatusChange(client)}
            disabled={isPending}
            className={`rounded-lg p-2 disabled:opacity-50 ${isSuspended ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-red-50 hover:text-red-600'}`}
            title={isSuspended ? 'Reactivar cliente' : 'Suspender cliente'}
          >
            {isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
            ) : isSuspended ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
