'use client';

import React, { useState } from 'react';
import { ShieldCheck, Home, Wrench } from 'lucide-react';

type RoleKey = 'admin' | 'residente' | 'staff';

const roles: Record<
  RoleKey,
  {
    icon: React.ElementType;
    label: string;
    color: string;
    accentBg: string;
    problem: string;
    description: string;
    actions: { text: string }[];
    previewRows: { label: string; value: string; valueColor: string }[];
  }
> = {
  admin: {
    icon: ShieldCheck,
    label: 'Administrador',
    color: 'text-primary',
    accentBg: 'bg-primary/10',
    problem: 'Información dispersa en WhatsApp, Excel y llamadas. Sin trazabilidad ni historial.',
    description:
      'Centraliza la gestión de edificios, unidades, usuarios e incidencias en un solo panel. Emite recibos, valida comprobantes y supervisa al staff sin depender de mensajes externos.',
    actions: [
      { text: 'Gestionar edificios, unidades y usuarios' },
      { text: 'Emitir y validar recibos de mantenimiento' },
      { text: 'Aprobar o rechazar reservas de áreas comunes' },
      { text: 'Supervisar incidencias y asignar al staff' },
      { text: 'Publicar avisos por edificio o rol' },
    ],
    previewRows: [
      { label: 'Incidencias abiertas', value: '7', valueColor: 'text-orange-600' },
      { label: 'Reservas pendientes', value: '4', valueColor: 'text-amber-600' },
      { label: 'Recibos por validar', value: '2', valueColor: 'text-blue-600' },
      { label: 'Edificios activos', value: '3', valueColor: 'text-slate-900' },
    ],
  },
  residente: {
    icon: Home,
    label: 'Residente',
    color: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    problem: 'Sin canal oficial para reportar fallas, reservar espacios ni saber el estado de sus solicitudes.',
    description:
      'El residente accede solo a la información de su edificio y unidad. Puede reportar incidencias, solicitar reservas, ver sus recibos y subir comprobantes sin depender de intermediarios.',
    actions: [
      { text: 'Ver y gestionar recibos propios' },
      { text: 'Subir comprobantes de pago' },
      { text: 'Reservar áreas comunes disponibles' },
      { text: 'Reportar incidencias con evidencia' },
      { text: 'Recibir avisos del edificio' },
    ],
    previewRows: [
      { label: 'Recibo activo', value: 'Pendiente', valueColor: 'text-blue-600' },
      { label: 'Mi reserva', value: 'Aprobada', valueColor: 'text-emerald-600' },
      { label: 'Incidencia reportada', value: 'En progreso', valueColor: 'text-amber-600' },
      { label: 'Avisos sin leer', value: '1', valueColor: 'text-slate-500' },
    ],
  },
  staff: {
    icon: Wrench,
    label: 'Staff',
    color: 'text-amber-600',
    accentBg: 'bg-amber-50',
    problem: 'Las tareas llegan por mensajes informales. Sin checklist, sin historial, sin evidencia documentada.',
    description:
      'El personal operativo recibe sus tareas directamente en el panel. Actualiza el estado del trabajo, completa checklists y adjunta evidencias fotográficas — todo en un solo lugar.',
    actions: [
      { text: 'Revisar tareas asignadas con prioridad' },
      { text: 'Actualizar estado: pendiente → en progreso → listo' },
      { text: 'Adjuntar evidencias fotográficas al cerrar' },
      { text: 'Ejecutar checklists operativos por tarea' },
      { text: 'Ver historial de trabajo propio' },
    ],
    previewRows: [
      { label: 'Tareas asignadas hoy', value: '3', valueColor: 'text-slate-900' },
      { label: 'En progreso', value: '1', valueColor: 'text-amber-600' },
      { label: 'Completadas esta semana', value: '8', valueColor: 'text-emerald-600' },
      { label: 'Checklists pendientes', value: '2', valueColor: 'text-blue-600' },
    ],
  },
};

const roleOrder: RoleKey[] = ['admin', 'residente', 'staff'];

export function LandingRoles() {
  const [active, setActive] = useState<RoleKey>('admin');
  const role = roles[active];
  const Icon = role.icon;

  return (
    <section id="roles" className="py-24 px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow */}
        <div className="flex items-center gap-4 justify-center mb-5">
          <span className="h-px w-12 bg-slate-300 block" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Roles</span>
          <span className="h-px w-12 bg-slate-300 block" />
        </div>

        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-4">
          Cada persona ve solo lo que le corresponde.
        </h2>
        <p className="text-center text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          PropSys distingue entre roles. Cada uno accede a su panel con la información y acciones
          relevantes para su función — sin sobreinformación, sin confusión.
        </p>

        {/* Role selector tabs */}
        <div className="flex justify-center mb-10">
          <div className="grid grid-cols-3 lg:flex lg:inline-flex bg-white border border-slate-200 rounded-2xl p-1.5 gap-1.5 shadow-sm w-full lg:w-auto">
            {roleOrder.map((key) => {
              const r = roles[key];
              const RIcon = r.icon;
              const isActive = active === key;
              return (
                <button
                  key={key}
                  id={`role-tab-${key}`}
                  onClick={() => setActive(key)}
                  className={`flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 px-1 py-2 lg:px-5 lg:py-3 rounded-xl text-[10px] sm:text-xs lg:text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <RIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-full">{r.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role detail */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Left: Info */}
          <div className="bg-white rounded-2xl border border-slate-100 p-8">
            {/* Icon + role name */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role.accentBg}`}>
                <Icon className={`w-6 h-6 ${role.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Rol</p>
                <p className="text-base font-black text-slate-900">{role.label}</p>
              </div>
            </div>

            {/* Problem */}
            <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                Problema que resuelve
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">{role.problem}</p>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{role.description}</p>

            {/* Actions */}
            <ul className="space-y-2.5">
              {role.actions.map((action) => (
                <li key={action.text} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 block ${
                    active === 'admin' ? 'bg-primary' :
                    active === 'residente' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  {action.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Mini preview panel */}
          <div>
            <div className="rounded-2xl border border-slate-200 shadow-lg overflow-hidden bg-white">
              {/* Panel header bar */}
              <div className={`px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 ${role.accentBg}`}>
                <Icon className={`w-4 h-4 ${role.color}`} />
                <p className={`text-sm font-bold ${role.color}`}>Panel — {role.label}</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 p-5">
                {role.previewRows.map((row) => (
                  <div key={row.label} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col items-center text-center">
                    <p className="text-[11px] text-slate-500 mb-1 leading-snug w-full truncate">{row.label}</p>
                    <p className={`text-2xl font-black ${row.valueColor}`}>{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Simulated nav items */}
              <div className="px-5 pb-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">
                  Accesos disponibles
                </p>
                <div className="space-y-1.5">
                  {role.actions.slice(0, 3).map((action) => (
                    <div
                      key={action.text}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        active === 'admin' ? 'bg-primary/40' :
                        active === 'residente' ? 'bg-emerald-300' : 'bg-amber-300'
                      }`} />
                      <span className="text-xs text-slate-600">{action.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Caption */}
            <p className="text-xs text-slate-400 text-center mt-4">
              Vista ilustrativa · El panel real incluye más módulos según la configuración
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
