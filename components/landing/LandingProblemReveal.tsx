'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Table2, CalendarX, AlertTriangle, Calendar, Receipt, Bell } from 'lucide-react';
import { GlowCard } from './GlowCard';

const problems = [
  {
    icon: MessageSquare,
    title: 'Incidencias por WhatsApp',
    description: 'Los reportes llegan por múltiples canales y se pierden entre conversaciones. No hay registro formal, no hay seguimiento, no hay cierre documentado.',
  },
  {
    icon: Table2,
    title: 'Cobros y comprobantes en Excel',
    description: 'Las transferencias se notifican por foto o mensaje. Conciliar quién pagó y quién no depende de revisión manual constante y propenso a errores.',
  },
  {
    icon: CalendarX,
    title: 'Reservas sin validación clara',
    description: 'Las áreas comunes se gestionan con agendas físicas o grupos de chat. Los conflictos de horario y las aprobaciones informales generan fricciones repetidas.',
  },
];

const features = [
  {
    icon: AlertTriangle,
    color: 'bg-indigo-50 text-indigo-500',
    title: 'Gestión de Incidencias',
    description: 'Los residentes reportan fallas con foto y descripción. El staff asigna, actualiza el estado y cierra el ticket. Cada cambio queda registrado con fecha y responsable.',
    tags: ['Ciclo de vida trazable', 'Evidencias adjuntas', 'Historial completo'],
  },
  {
    icon: Calendar,
    color: 'bg-indigo-50 text-indigo-500',
    title: 'Reservas de Áreas Comunes',
    description: 'Los residentes solicitan espacios desde su panel. El administrador revisa y aprueba. El calendario muestra disponibilidad sin exponer datos de otros usuarios.',
    tags: ['Vista de calendario', 'Privacidad por rol', 'Aprobación manual'],
  },
  {
    icon: Receipt,
    color: 'bg-indigo-50 text-indigo-500',
    title: 'Recibos y Comprobantes',
    description: 'El administrador emite recibos de mantenimiento. El residente sube su comprobante. El admin valida y registra el pago. El proceso es manual y supervisado.',
    tags: ['Almacenamiento privado', 'Validación manual', 'Registro por unidad'],
  },
  {
    icon: Bell,
    color: 'bg-indigo-50 text-indigo-500',
    title: 'Avisos y Comunicados',
    description: 'Publica avisos segmentados por edificio, rol o unidad. Los residentes los ven en su panel sin necesidad de grupos de WhatsApp ni correos masivos.',
    tags: ['Segmentación por edificio', 'Entrega inmediata', 'Sin intermediarios'],
  },
];

export function LandingProblemReveal() {
  return (
    <div className="relative bg-[#FAFAFA] py-24 lg:py-32">
      
      {/* === SECTION 1: THE PROBLEM === */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center justify-center px-6 mb-32"
      >
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-4 justify-center mb-5">
            <span className="h-px w-12 bg-slate-300 block" />
            <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
              El Problema
            </span>
            <span className="h-px w-12 bg-slate-300 block" />
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-4">
            La gestión actual está fragmentada.
          </h2>
          <p className="text-center text-slate-600 max-w-xl mx-auto mb-14 leading-relaxed">
            La mayoría de administradoras combinan WhatsApp, Excel y agendas en papel. El resultado
            es información dispersa, errores repetidos y residentes insatisfechos.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {problems.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-sm p-7 flex flex-col items-center text-center lg:items-start lg:text-left">
                <div className="w-12 h-12 shrink-0 rounded-xl bg-red-50 flex items-center justify-center mb-5 mx-auto lg:mx-0">
                  <Icon className="w-6 h-6 text-red-500" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* === SECTION 2: THE PRODUCT === */}
      <motion.section 
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="flex flex-col items-center justify-center px-6"
      >
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-4 justify-center mb-5">
            <span className="h-px w-12 bg-indigo-200 block" />
            <span className="text-xs font-bold tracking-widest uppercase text-indigo-600">
              Producto
            </span>
            <span className="h-px w-12 bg-indigo-200 block" />
          </div>

          <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-4">
            Todo lo que tu administración necesita, en un solo lugar.
          </h2>
          <p className="text-center text-slate-600 max-w-xl mx-auto mb-14 leading-relaxed">
            Módulos operativos diseñados para las tareas diarias reales de edificios y condominios.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map(({ icon: Icon, color, title, description, tags }) => (
              <GlowCard key={title} className="flex flex-col items-center text-center lg:items-start lg:text-left">
                <div className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center mb-6 mx-auto lg:mx-0 ${color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-5">{description}</p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs text-slate-600 bg-white/50 border border-slate-200 px-2.5 py-1 rounded-lg">
                      {tag}
                    </span>
                  ))}
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      </motion.section>

    </div>
  );
}
