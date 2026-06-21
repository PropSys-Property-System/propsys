'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneIncoming,
  ClipboardList,
  UserCheck,
  ImageIcon,
  CheckCircle2,
  Receipt,
  UploadCloud,
  Eye,
  BadgeCheck,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

type FlowType = 'operacional' | 'financiero';

const operationalSteps = [
  {
    id: 1,
    icon: PhoneIncoming,
    color: 'bg-red-50 text-red-500 border-red-100',
    label: 'Reporte',
    title: 'El residente reporta',
    description: 'El residente describe la falla con texto y foto desde su panel. El reporte llega inmediatamente al administrador con fecha y unidad registradas.',
    badge: 'Nueva incidencia',
    badgeColor: 'bg-red-50 text-red-600 border border-red-200',
    preview: [
      { line: 'Luminaria fundida — Pasillo 3er piso', sub: 'Unidad 301 · Torre A · hace 2 min' },
      { line: 'Evidencia adjunta', sub: 'foto_luminaria.jpg · 1.2 MB' },
    ],
  },
  {
    id: 2,
    icon: UserCheck,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    label: 'Asignación',
    title: 'El admin asigna al staff',
    description: 'El administrador revisa la incidencia y la asigna al técnico disponible. El staff recibe la tarea en su panel sin necesidad de mensajes externos.',
    badge: 'Asignada',
    badgeColor: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    preview: [
      { line: 'Asignado a: Equipo operativo', sub: 'Prioridad media · Plazo: hoy' },
      { line: 'Staff notificado en panel', sub: 'Sin WhatsApp, sin correo' },
    ],
  },
  {
    id: 3,
    icon: ClipboardList,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    label: 'Seguimiento',
    title: 'El staff actualiza el estado',
    description: 'El técnico marca la tarea como "en progreso" cuando empieza y actualiza el estado al avanzar. El historial queda registrado con timestamps.',
    badge: 'En progreso',
    badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200',
    preview: [
      { line: 'Estado actualizado: En progreso', sub: 'Equipo operativo · 14:18' },
      { line: 'Checklist: 2 de 4 ítems', sub: 'Última actualización: hace 5 min' },
    ],
  },
  {
    id: 4,
    icon: ImageIcon,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    label: 'Evidencia',
    title: 'Se adjuntan evidencias',
    description: 'Al terminar, el técnico adjunta fotografías del trabajo finalizado. Las evidencias se almacenan con el ticket y quedan disponibles para auditoría.',
    badge: 'Evidencia subida',
    badgeColor: 'bg-blue-50 text-blue-600 border border-blue-200',
    preview: [
      { line: 'foto_reparacion.jpg subida', sub: 'Almacenado seguro · 2.1 MB' },
      { line: '4 de 4 ítems completados', sub: 'Equipo operativo · 14:32' },
    ],
  },
  {
    id: 5,
    icon: CheckCircle2,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    label: 'Cierre',
    title: 'El admin cierra el ticket',
    description: 'El administrador revisa la evidencia y cierra la incidencia. El residente puede ver el estado final. El historial es permanente.',
    badge: 'Resuelta',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    preview: [
      { line: 'Incidencia cerrada', sub: 'Tiempo total: 4h 14min' },
      { line: 'Residente notificado', sub: 'Estado: Resuelta' },
    ],
  },
];

const financialSteps = [
  {
    id: 1,
    icon: Receipt,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    label: 'Recibo emitido',
    title: 'El admin emite el recibo',
    description: 'El administrador genera el recibo de mantenimiento para la unidad con monto, período y descripción. El residente lo ve en su panel de inmediato.',
    badge: 'Emitido',
    badgeColor: 'bg-blue-50 text-blue-600 border border-blue-200',
    preview: [
      { line: 'Recibo Enero 2026 — Unidad 101', sub: 'Monto: S/ 280.00 · Torre A' },
      { line: 'Visible para residente', sub: 'Estado: Pendiente de pago' },
    ],
  },
  {
    id: 2,
    icon: UploadCloud,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    label: 'Comprobante subido',
    title: 'El residente sube el comprobante',
    description: 'El residente realiza la transferencia y sube la foto o PDF del comprobante desde su panel, sin necesidad de WhatsApp ni correo.',
    badge: 'Recibido',
    badgeColor: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    preview: [
      { line: 'comprobante_ene26.jpg subido', sub: 'Unidad 101 · hace 8 min' },
      { line: 'En espera de revisión', sub: 'Almacenado de forma privada' },
    ],
  },
  {
    id: 3,
    icon: Eye,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    label: 'Revisión',
    title: 'El admin revisa el comprobante',
    description: 'El administrador abre el comprobante en el panel, verifica el monto y toma la decisión de aprobar o rechazar con observaciones.',
    badge: 'En revisión',
    badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200',
    preview: [
      { line: 'Revisando: comprobante.jpg', sub: 'Monto declarado: S/ 280.00' },
      { line: 'Aprobación manual', sub: 'El humano decide' },
    ],
  },
  {
    id: 4,
    icon: BadgeCheck,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    label: 'Validado',
    title: 'El pago queda registrado',
    description: 'El administrador valida el pago. El recibo queda marcado como pagado. El residente ve el estado actualizado. El historial es permanente.',
    badge: 'Pagado',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    preview: [
      { line: 'Recibo Enero 2026 — PAGADO', sub: 'Validado por: Admin · 15:41' },
      { line: 'Historial actualizado', sub: 'Unidad 101 · Torre A' },
    ],
  },
];

export function LandingFlow() {
  const [activeFlow, setActiveFlow] = useState<FlowType>('financiero');
  const [activeStep, setActiveStep] = useState(0);

  const steps = activeFlow === 'operacional' ? operationalSteps : financialSteps;

  // Render a step's preview panel
  const renderPreview = (step: typeof steps[0], index: number, isDesktop: boolean) => (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 h-full flex flex-col justify-center">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200">
        <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border ${step.color}`}>
          <step.icon className="w-6 h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
            Paso {step.id} de {steps.length}
          </p>
          <p className="text-sm font-black text-slate-900 truncate">{step.title}</p>
        </div>
        <span className={`hidden sm:inline-block text-xs px-2.5 py-1 rounded-lg font-semibold border shrink-0 ${step.badgeColor}`}>
          {step.badge}
        </span>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-5">{step.description}</p>
      <div className="space-y-2 flex-1">
        {step.preview.map((item, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-800">{item.line}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>
      
      {isDesktop && index < steps.length - 1 && (
        <button
          onClick={() => setActiveStep(index + 1)}
          className="mt-6 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 transition-colors"
        >
          Ver siguiente paso
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <section id="flujo" className="py-24 px-6 bg-white relative">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 justify-center mb-5">
          <span className="h-px w-12 bg-slate-300 block" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Del caos al control</span>
          <span className="h-px w-12 bg-slate-300 block" />
        </div>
        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-4">
          Cada operación tiene un flujo claro.
        </h2>
        <p className="text-center text-slate-600 max-w-xl mx-auto mb-10 leading-relaxed">
          PropSys organiza los procesos más repetidos en pasos trazables.
        </p>

        {/* Tab selector */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setActiveFlow('financiero'); setActiveStep(0); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeFlow === 'financiero' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Flujo de recibos
            </button>
            <button
              onClick={() => { setActiveFlow('operacional'); setActiveStep(0); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${
                activeFlow === 'operacional' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Flujo de incidencias
            </button>
          </div>
        </div>

        {/* Desktop: Interactive Clicks */}
        <div className="hidden lg:grid grid-cols-2 gap-16 items-start">
          <div className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(i)}
                className={`text-left flex items-center justify-between gap-6 p-6 rounded-2xl transition-all border outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group ${
                  activeStep === i 
                    ? 'bg-slate-50 border-slate-200 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50/50 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-6">
                  <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${step.color}`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1 transition-colors group-hover:text-indigo-500">
                      Paso {i + 1}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mb-1">{step.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 shrink-0 transition-transform ${activeStep === i ? 'text-indigo-500 translate-x-1' : 'text-slate-300 group-hover:text-slate-400 group-hover:translate-x-1'}`} />
              </button>
            ))}
          </div>

          <div className="sticky top-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderPreview(steps[activeStep], activeStep, true)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile: Intercalated Stack */}
        <div className="lg:hidden flex flex-col gap-12">
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${step.color}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1`}>
                    Paso {step.id}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                </div>
              </div>
              <div>{renderPreview(step, i, false)}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
