'use client';

import React, { useEffect, useState } from 'react';
import { Mail, XCircle, Check, Copy } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/lib/auth/auth-context';

type Invitation = {
  id: string;
  email: string;
  clientId: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  name: string;
  role: string;
  internalRole: string;
};

export default function AdminInvitationsPage() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const fetchInvitations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users/invitations');
      if (res.ok) {
        const data = await res.json();
        setInvitations(data.data || []);
      }
    } catch {
      setMessage({ text: 'Error al cargar invitaciónes', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, []);

  const handleAction = async (id: string, action: 'REVOKE' | 'REISSUE') => {
    if (action === 'REVOKE' && !window.confirm('¿Seguro que deseas revocar esta invitación?')) return;

    setActionLoading(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/users/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || `Error al ${action === 'REVOKE' ? 'revocar' : 'reemitir'} la invitación`, type: 'error' });
      } else {
        if (action === 'REVOKE') {
          setInvitations(prev => prev.filter(inv => inv.id !== id));
          setMessage({ text: 'Invitación revocada', type: 'success' });
        } else if (action === 'REISSUE' && data.delivery?.inviteLink) {
          await navigator.clipboard.writeText(data.delivery.inviteLink);
          setCopiedLink(id);
          setMessage({ text: 'Nuevo link generado y copiado al portapapeles', type: 'success' });
          setTimeout(() => setCopiedLink(null), 3000);
          fetchInvitations(); // Refresh to get new expiration date
        }
      }
    } catch {
      setMessage({ text: 'Error de red', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  if (!user || (user.internalRole !== 'ROOT_ADMIN' && user.internalRole !== 'CLIENT_MANAGER')) {
    return <div className="p-8">No autorizado</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader 
        title="Invitaciónes Pendientes" 
        description="Gestiona invitaciónes enviadas que aún no han sido aceptadas." 
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? <Check className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando invitaciónes...</div>
          ) : invitations.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="text-slate-500">No hay invitaciónes pendientes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-medium">Usuario</th>
                    <th className="px-6 py-4 font-medium">Email</th>
                    <th className="px-6 py-4 font-medium">Rol</th>
                    <th className="px-6 py-4 font-medium">Expira</th>
                    <th className="px-6 py-4 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invitations.map((inv) => {
                    const isExpired = new Date(inv.expiresAt) < new Date();
                    
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{inv.name}</td>
                        <td className="px-6 py-4">{inv.email}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                            {inv.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={isExpired ? 'text-red-600 font-medium' : 'text-slate-500'}>
                            {new Date(inv.expiresAt).toLocaleDateString()} {isExpired && '(Expirada)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleAction(inv.id, 'REISSUE')}
                              disabled={actionLoading !== null}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                copiedLink === inv.id 
                                  ? 'bg-green-50 text-green-700 border border-green-200' 
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-50'
                              }`}
                              title="Generar nuevo link y copiar"
                            >
                              {copiedLink === inv.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              Reemitir Link
                            </button>
                            <button
                              onClick={() => handleAction(inv.id, 'REVOKE')}
                              disabled={actionLoading !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Revocar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
