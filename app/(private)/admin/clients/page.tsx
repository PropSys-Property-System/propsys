'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { useAuth } from '@/lib/auth/auth-context';
import {
  listAdminClients,
  createAdminClient,
  updateAdminClientStatus,
  updateAdminClientProfile,
} from '@/lib/features/users/clients-center.data';
import { ClientCard } from '@/lib/features/users/clients-center.ui';
import type { ClientAccount } from '@/lib/repos/core/clients.repo';

type FormMode = 'edit';

type ClientFormState = {
  name: string;
};

const INITIAL_FORM: ClientFormState = {
  name: '',
};

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(INITIAL_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [isClientSubmitting, setIsClientSubmitting] = useState(false);

  const canManageClients = user?.internalRole === 'ROOT_ADMIN';

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!user || !canManageClients) return;

      try {
        setIsLoading(true);
        setError(null);
        setActionError(null);
        const data = await listAdminClients(user, true); // true for includeSuspended
        if (!isMounted) return;
        setClients(data);
      } catch {
        if (!isMounted) return;
        setError('No pudimos cargar los clientes.');
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [user, canManageClients]);

  async function handleStatusChange(target: ClientAccount) {
    if (!user) return;

    const nextStatus = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const actionLabel = nextStatus === 'SUSPENDED' ? 'suspender' : 'reactivar';
    const confirmed = window.confirm(`¿Quieres ${actionLabel} el cliente ${target.name}?`);
    if (!confirmed) return;

    try {
      setPendingClientId(target.id);
      setActionError(null);
      const updated = await updateAdminClientStatus(user, { id: target.id, status: nextStatus });
      setClients((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, status: updated.status } : item))
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos actualizar el estado del cliente.');
    } finally {
      setPendingClientId(null);
    }
  }

  function closeForm() {
    setFormMode(null);
    setEditingClientId(null);
    setFormState(INITIAL_FORM);
    setFormSubmitting(false);
  }

  function handleOpenEditForm(target: ClientAccount) {
    setActionError(null);
    setFormMode('edit');
    setEditingClientId(target.id);
    setFormState({ name: target.name });
  }

  async function handleSubmitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !formMode) return;

    const name = formState.name.trim();
    if (!name) {
      setActionError('Completa el nombre del cliente.');
      return;
    }

    try {
      setFormSubmitting(true);
      setActionError(null);

      if (editingClientId) {
        const updated = await updateAdminClientProfile(user, {
          id: editingClientId,
          name,
        });
        setClients((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      }

      closeForm();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos guardar el cliente.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleCreateClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !canManageClients) return;
    
    const name = newClientName.trim();
    if (!name) {
      setActionError('Ingresa el nombre del cliente.');
      return;
    }

    try {
      setIsClientSubmitting(true);
      setActionError(null);
      const created = await createAdminClient(user, { name });
      setClients((current) => [created, ...current.filter((client) => client.id !== created.id)]);
      setNewClientName('');
      setIsClientFormOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No pudimos crear el cliente.');
    } finally {
      setIsClientSubmitting(false);
    }
  }

  const filteredClients = useMemo(() => {
    const normalizedTerm = searchTerm.toLowerCase();
    return clients.filter((candidate) => {
      return candidate.name.toLowerCase().includes(normalizedTerm) || candidate.id.toLowerCase().includes(normalizedTerm);
    });
  }, [clients, searchTerm]);

  if (!canManageClients) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50">
        <PageHeader title="Gestión de clientes" description="Administración global de clientes." />
        <div className="p-6 md:p-8">
          <ErrorState title="Acceso denegado" description="No tienes permisos para ver esta pagina." />
        </div>
      </div>
    );
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setActionError(null);
          setNewClientName('');
          setIsClientFormOpen(true);
        }}
        className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition"
      >
        Nuevo cliente
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader title="Gestión de clientes" description="Administra las empresas que usan PropSys." actions={actions} />

      <div className="p-6 md:p-8 space-y-6">
        <div className="relative group max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre o ID..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all text-sm font-medium"
          />
        </div>

        {actionError ? (
          <div className="max-w-2xl rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {actionError}
          </div>
        ) : null}

        {isClientFormOpen ? (
          <form onSubmit={handleCreateClient} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900">Nuevo cliente</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Crea una empresa administrada antes de invitar su manager.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsClientFormOpen(false)}
                disabled={isClientSubmitting}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cerrar
              </button>
            </div>
            <label className="space-y-1 block">
              <span className="text-xs font-bold text-slate-600">Nombre del cliente</span>
              <input
                type="text"
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="Ej: Administraciónes Norte SAC"
                autoFocus
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsClientFormOpen(false)}
                disabled={isClientSubmitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isClientSubmitting}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {isClientSubmitting ? 'Creando...' : 'Crear cliente'}
              </button>
            </div>
          </form>
        ) : null}

        {formMode ? (
          <form onSubmit={handleSubmitForm} className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Editar cliente</h2>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cerrar
              </button>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-bold text-slate-600">Nombre</span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary"
                required
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={formSubmitting}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {formSubmitting ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        ) : null}

        {error ? (
          <ErrorState title="Error" description={error} />
        ) : isLoading ? (
          <LoadingState title="Cargando clientes..." />
        ) : filteredClients.length === 0 ? (
          <EmptyState title="Sin clientes" description={searchTerm ? `No hay resultados para "${searchTerm}".` : 'No hay clientes registrados.'} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                pendingClientId={pendingClientId}
                onStatusChange={handleStatusChange}
                onEdit={handleOpenEditForm}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
