'use client';

import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type FlowType = 'operacional' | 'financiero';

const operationalSteps = [
  {
    id: 1,
    icon: PhoneIncoming,
    color: 'bg-red-50 text-red-500 border-red-100',
    lineColor: 'bg-red-200',
    label: 'Reporte',
    title: 'El residente reporta',
    description:
      'El residente describe la falla con texto y foto desde su panel. El reporte llega inmediatamente al administrador con fecha y unidad registradas.',
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
    color: 'bg-violet-50 text-violet-600 border-violet-100',
    lineColor: 'bg-violet-200',
    label: 'Asignación',
    title: 'El admin asigna al staff',
    description:
      'El administrador revisa la incidencia y la asigna al técnico disponible. El staff recibe la tarea en su panel sin necesidad de mensajes externos.',
    badge: 'Asignada',
    badgeColor: 'bg-violet-50 text-violet-600 border border-violet-200',
    preview: [
      { line: 'Asignado a: Equipo operativo', sub: 'Prioridad media · Plazo: hoy' },
      { line: 'Staff notificado en panel', sub: 'Sin WhatsApp, sin correo adicional' },
    ],
  },
  {
    id: 3,
    icon: ClipboardList,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    lineColor: 'bg-amber-200',
    label: 'Seguimiento',
    title: 'El staff actualiza el estado',
    description:
      'El técnico marca la tarea como "en progreso" cuando empieza y actualiza el estado al avanzar. El historial queda registrado con timestamps.',
    badge: 'En progreso',
    badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200',
    preview: [
      { line: 'Estado actualizado: En progreso', sub: 'Equipo operativo · 14:18' },
      { line: 'Checklist: 2 de 4 ítems completados', sub: 'Última actualización: hace 5 min' },
    ],
  },
  {
    id: 4,
    icon: ImageIcon,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    lineColor: 'bg-blue-200',
    label: 'Evidencia',
    title: 'Se adjuntan evidencias',
    description:
      'Al terminar, el técnico adjunta fotografías del trabajo finalizado. Las evidencias se almacenan con el ticket y quedan disponibles para auditoría.',
    badge: 'Evidencia subida',
    badgeColor: 'bg-blue-50 text-blue-600 border border-blue-200',
    preview: [
      { line: 'foto_reparacion_01.jpg subida', sub: 'Almacenado de forma privada · 2.1 MB' },
      { line: '4 de 4 ítems del checklist completados', sub: 'Equipo operativo · 14:32' },
    ],
  },
  {
    id: 5,
    icon: CheckCircle2,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    lineColor: 'bg-emerald-200',
    label: 'Cierre',
    title: 'El admin cierra el ticket',
    description:
      'El administrador revisa la evidencia y cierra la incidencia. El residente puede ver el estado final desde su panel. El historial es permanente.',
    badge: 'Resuelta',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    preview: [
      { line: 'Incidencia cerrada · Luminaria Pasillo 3°', sub: 'Tiempo total: 4h 14min' },
      { line: 'Historial completo disponible', sub: 'Residente notificado · Estado: Resuelta' },
    ],
  },
];

const financialSteps = [
  {
    id: 1,
    icon: Receipt,
    color: 'bg-blue-50 text-blue-600 border-blue-100',
    lineColor: 'bg-blue-200',
    label: 'Recibo emitido',
    title: 'El admin emite el recibo',
    description:
      'El administrador genera el recibo de mantenimiento para la unidad con monto, período y descripción. El residente lo ve en su panel de inmediato.',
    badge: 'Emitido',
    badgeColor: 'bg-blue-50 text-blue-600 border border-blue-200',
    preview: [
      { line: 'Recibo Enero 2026 — Unidad 101', sub: 'Monto: S/ 280.00 · Torre A' },
      { line: 'Visible para el residente', sub: 'Estado: Pendiente de pago' },
    ],
  },
  {
    id: 2,
    icon: UploadCloud,
    color: 'bg-violet-50 text-violet-600 border-violet-100',
    lineColor: 'bg-violet-200',
    label: 'Comprobante subido',
    title: 'El residente sube el comprobante',
    description:
      'El residente realiza la transferencia y sube la foto o PDF del comprobante desde su panel, sin necesidad de WhatsApp ni correo.',
    badge: 'Comprobante recibido',
    badgeColor: 'bg-violet-50 text-violet-600 border border-violet-200',
    preview: [
      { line: 'comprobante_ene26.jpg subido', sub: 'Unidad 101 · hace 8 min · 0.9 MB' },
      { line: 'En espera de revisión', sub: 'Almacenado de forma privada' },
    ],
  },
  {
    id: 3,
    icon: Eye,
    color: 'bg-amber-50 text-amber-600 border-amber-100',
    lineColor: 'bg-amber-200',
    label: 'Revisión',
    title: 'El admin revisa el comprobante',
    description:
      'El administrador abre el comprobante en el panel, verifica el monto y la fecha, y toma la decisión de aprobar o rechazar con observaciones.',
    badge: 'En revisión',
    badgeColor: 'bg-amber-50 text-amber-700 border border-amber-200',
    preview: [
      { line: 'Revisando: comprobante_ene26.jpg', sub: 'Monto declarado: S/ 280.00' },
      { line: 'Pendiente de aprobación manual', sub: 'El humano decide · sin automatismo' },
    ],
  },
  {
    id: 4,
    icon: BadgeCheck,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    lineColor: 'bg-emerald-200',
    label: 'Validado',
    title: 'El pago queda registrado',
    description:
      'El administrador valida el pago. El recibo queda marcado como pagado. El residente ve el estado actualizado. El historial es permanente por unidad.',
    badge: 'Pagado',
    badgeColor: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    preview: [
      { line: 'Recibo Enero 2026 — PAGADO', sub: 'Validado por: Admin · 15:41' },
      { line: 'Historial financiero actualizado', sub: 'Unidad 101 · Torre A' },
    ],
  },
];

export function LandingFlow() {
  const [activeFlow, setActiveFlow] = useState<FlowType>('financiero');
  const [activeStep, setActiveStep] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const steps = activeFlow === 'operacional' ? operationalSteps : financialSteps;
  const current = steps[activeStep];

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (diff > 50 && activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
    if (diff < -50 && activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
    setTouchStart(null);
  };

  return (
    <section id="flujo" className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow */}
        <div className="flex items-center gap-4 justify-center mb-5">
          <span className="h-px w-12 bg-slate-300 block" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
            Del caos al control
          </span>
          <span className="h-px w-12 bg-slate-300 block" />
        </div>

        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-4">
          Cada operación tiene un flujo claro.
        </h2>
        <p className="text-center text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
          PropSys organiza los procesos más repetidos de tu edificio en pasos trazables y auditables.
          Selecciona un flujo para ver cómo funciona.
        </p>

        {/* Flow type selector */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
            <button
              id="flow-tab-financiero"
              onClick={() => { setActiveFlow('financiero'); setActiveStep(0); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeFlow === 'financiero'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Flujo de recibos
            </button>
            <button
              id="flow-tab-operacional"
              onClick={() => { setActiveFlow('operacional'); setActiveStep(0); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeFlow === 'operacional'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Flujo de incidencias
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Step list (Desktop only) */}
          <div className="hidden lg:flex flex-col space-y-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === activeStep;
              return (
                <button
                  key={step.id}
                  id={`flow-step-${activeFlow}-${i}`}
                  onClick={() => setActiveStep(i)}
                  className={`w-full text-left flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 shadow-lg'
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {/* Step number + icon */}
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
                    isActive ? 'bg-white/15 border-white/20' : step.color
                  }`}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        isActive ? 'text-slate-400' : 'text-slate-400'
                      }`}>
                        Paso {step.id}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                        isActive ? 'bg-white/10 text-white border-white/20' : step.badgeColor
                      }`}>
                        {step.badge}
                      </span>
                    </div>
                    <p className={`text-sm font-bold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                      {step.title}
                    </p>
                    {isActive && (
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Detail panel */}
          <div className="sticky top-24">
            <div 
              className="rounded-2xl border border-slate-100 bg-slate-50 p-6 touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Panel header */}
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-200">
                <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border ${current.color}`}>
                  <current.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    Paso {current.id} de {steps.length}
                  </p>
                  <p className="text-sm font-black text-slate-900 truncate">{current.title}</p>
                </div>
                <span className={`hidden sm:inline-block text-xs px-2.5 py-1 rounded-lg font-semibold border shrink-0 ${current.badgeColor}`}>
                  {current.badge}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-slate-600 leading-relaxed mb-5">
                {current.description}
              </p>

              {/* Mini preview — simulated log entries */}
              <div className="space-y-2 mb-5">
                {current.preview.map((item, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-100 px-4 py-3">
                    <p className="text-xs font-semibold text-slate-800">{item.line}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => activeStep > 0 && setActiveStep(activeStep - 1)}
                  disabled={activeStep === 0}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 disabled:bg-slate-50 bg-white hover:bg-slate-100 transition-colors"
                  aria-label="Paso anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Progress dots */}
                <div className="flex items-center gap-2">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      aria-label={`Ir al paso ${i + 1}`}
                      className={`rounded-full transition-all ${
                        i === activeStep
                          ? 'w-6 h-2 bg-slate-900'
                          : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => activeStep < steps.length - 1 && setActiveStep(activeStep + 1)}
                  disabled={activeStep === steps.length - 1}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 disabled:opacity-30 disabled:bg-slate-50 bg-white hover:bg-slate-100 transition-colors"
                  aria-label="Siguiente paso"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
