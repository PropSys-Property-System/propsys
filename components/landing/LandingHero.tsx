import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  LayoutDashboard,
  Receipt,
  Users,
  ClipboardList,
  AlertTriangle,
  CalendarDays,
  Bell,
  Building2,
  CheckCheck,
} from 'lucide-react';

const DEMO_HREF =
  'mailto:contact.orbitalframeworks@gmail.com?subject=Demo%20PropSys%20-%20Solicitud%20de%20informaci%C3%B3n';

export function LandingHero() {
  return (
    <section className="pt-28 pb-24 lg:pt-32 lg:pb-32 px-6 bg-white overflow-hidden flex items-center">
      <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-[0.9fr_1.1fr] gap-10 xl:gap-14 items-center">
        {/* Copy block */}
        <div className="max-w-2xl mx-auto lg:mx-0 z-10 relative">
          <p className="text-xs font-bold tracking-widest uppercase text-primary mb-6">
            Beta controlada — disponible ahora
          </p>
          <h1 className="text-5xl lg:text-[3.5rem] lg:leading-[1.1] font-black text-slate-900 tracking-tight mb-6">
            Centraliza la operación de tus edificios.
          </h1>
          <p className="text-lg lg:text-xl text-slate-500 leading-relaxed mb-10 max-w-xl">
            PropSys ayuda a administradoras a organizar incidencias, reservas, áreas comunes y
            comprobantes de pago en una plataforma clara, trazable y preparada para equipos reales.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              id="hero-demo-cta"
              href={DEMO_HREF}
              className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl bg-primary text-white font-black text-sm tracking-wide shadow-xl shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/35 transition-all active:scale-[0.98]"
            >
              Solicitar demo
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#flujo"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
            >
              Ver cómo funciona
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {['Sin instalación', 'Multi-edificio', 'Roles y permisos', 'Beta activa'].map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-sm text-slate-500">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Command Center */}
        <div className="relative w-full max-w-2xl mx-auto lg:max-w-none">
          <div className="z-10 relative">
            <CommandCenter />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Sidebar nav items with real Lucide icons ────────────────────────────────
const navItems = [
  { name: 'Recibos',       icon: Receipt,        badge: null },
  { name: 'Personal',      icon: Users,          badge: null },
  { name: 'Tareas',        icon: ClipboardList,  badge: null },
  { name: 'Incidencias',   icon: AlertTriangle,  badge: '3' },
  { name: 'Áreas comunes', icon: CheckCheck,     badge: null },
  { name: 'Reservas',      icon: CalendarDays,   badge: '4' },
  { name: 'Avisos',        icon: Bell,           badge: null },
  { name: 'Edificios',     icon: Building2,      badge: null },
];

// ─── KPI cards with icons ────────────────────────────────────────────────────
const kpis = [
  { label: 'Edificios',   value: '3', sub: 'activos',      accent: 'bg-primary/10',  iconColor: 'text-primary',     Icon: Building2     },
  { label: 'Incidencias', value: '7', sub: 'abiertas',     accent: 'bg-orange-50',   iconColor: 'text-orange-500',  Icon: AlertTriangle },
  { label: 'Reservas',    value: '4', sub: 'pendientes',   accent: 'bg-amber-50',    iconColor: 'text-amber-600',   Icon: CalendarDays  },
  { label: 'Recibos',     value: '2', sub: 'por validar',  accent: 'bg-emerald-50',  iconColor: 'text-emerald-600', Icon: Receipt       },
];

function CommandCenter() {
  return (
    <div className="relative">
      {/* Main panel */}
      <div className="relative rounded-2xl border border-slate-200 shadow-2xl overflow-hidden bg-white">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <span className="w-3 h-3 rounded-full bg-red-400 block" />
          <span className="w-3 h-3 rounded-full bg-amber-400 block" />
          <span className="w-3 h-3 rounded-full bg-green-400 block" />
          <span className="ml-4 flex-1 max-w-xs bg-slate-200 rounded-md h-5 text-xs text-slate-500 flex items-center px-3">
            propsys.onrender.com/admin/dashboard
          </span>
        </div>

        {/* Dashboard layout */}
        <div className="flex h-auto lg:h-[440px]">

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <div className="w-44 lg:w-52 border-r border-slate-100 bg-slate-50 flex flex-col shrink-0">
            {/* Brand header */}
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="font-black text-sm text-slate-900">PropSys</p>
              <p className="text-xs text-slate-400">Plataforma</p>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-2 space-y-0.5 overflow-hidden">
              {/* Active item: Panel */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="text-xs font-semibold">Panel</span>
              </div>

              {/* Rest of nav */}
              {navItems.map(({ name, icon: Icon, badge }) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg text-slate-500"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="text-xs">{name}</span>
                  </div>
                  {badge && (
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                      {badge}
                    </span>
                  )}
                </div>
              ))}
            </nav>

            {/* User footer — manager identity, not internal root */}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-xs font-black flex items-center justify-center shrink-0">
                A
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">Administración</p>
                <p className="text-[11px] text-slate-400 truncate">Administradora</p>
              </div>
            </div>
          </div>

          {/* ── Main area ────────────────────────────────────────────────── */}
          <div className="flex-1 p-4 lg:p-6 overflow-hidden">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-slate-900">Panel General</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Panel de gestión. Aquí tienes el resumen de tu operación.
              </p>
            </div>

            {/* KPI cards with icons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-4">
              {kpis.map(({ label, value, sub, accent, iconColor, Icon }) => (
                <div key={label} className="bg-white rounded-xl border border-slate-100 p-3">
                  <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center mb-2`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">{label}</p>
                  <p className="text-2xl font-black text-slate-900">{value}</p>
                  <p className="text-[10px] text-slate-400">{sub}</p>
                </div>
              ))}
            </div>

            {/* Two column bottom — activity + receipts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Activity */}
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-3">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">Actividad reciente</p>
                <div className="space-y-1.5">
                  {[
                    { text: 'Terraza / Parrilla — Torre A', tag: 'Solicitada', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
                    { text: 'Luminaria Pasillo',            tag: 'Asignada',   color: 'bg-violet-50 text-violet-700 border border-violet-200' },
                    { text: 'Salón Social — Torre B',       tag: 'Aprobada',   color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 truncate">{item.text}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap shrink-0 ${item.color}`}>
                        {item.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Receipts mini list */}
              <div className="bg-white rounded-xl border border-slate-100 p-3">
                <p className="text-[11px] font-semibold text-slate-600 mb-2">Recibos pendientes</p>
                <div className="space-y-1.5">
                  {[
                    { unit: 'Unidad 101 — Torre A', status: 'Pendiente',   color: 'text-blue-600' },
                    { unit: 'Unidad 202 — Torre B', status: 'En revisión', color: 'text-amber-600' },
                    { unit: 'Unidad 103 — Torre A', status: 'Pagado',      color: 'text-emerald-600' },
                  ].map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 truncate">{r.unit}</span>
                      <span className={`text-[10px] font-bold shrink-0 ${r.color}`}>{r.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating annotation cards (lg+ only) ─────────────────────────── */}

      {/* Card: Incidencia resuelta */}
      <div className="hidden lg:flex absolute -right-6 top-16 flex-col gap-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52 z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 block" />
          <p className="text-[11px] font-bold text-slate-700">Incidencia cerrada</p>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Luminaria fundida — Pasillo 3er piso · Resuelta en 4h
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">Equipo operativo · 14:32</p>
      </div>

      {/* Card: Comprobante recibido */}
      <div className="hidden lg:flex absolute -left-6 bottom-20 flex-col gap-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52 z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-blue-400 block" />
          <p className="text-[11px] font-bold text-slate-700">Comprobante recibido</p>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Unidad 101 · Recibo Enero 2026 · En revisión
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">Subido hace 12 min</p>
      </div>

      {/* Card: Reserva aprobada */}
      <div className="hidden lg:flex absolute right-48 -bottom-6 flex-col gap-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52 z-10">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 block" />
          <p className="text-[11px] font-bold text-slate-700">Reserva aprobada</p>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Terraza / Parrilla · Lunes 10:00–12:00
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">Solicitada por: Unidad B-201</p>
      </div>
    </div>
  );
}
