import React from 'react';
import { MessageSquare, Table2, CalendarX } from 'lucide-react';

const problems = [
  {
    icon: MessageSquare,
    title: 'Incidencias por WhatsApp',
    description:
      'Los reportes llegan por múltiples canales y se pierden entre conversaciones. No hay registro formal, no hay seguimiento, no hay cierre documentado.',
  },
  {
    icon: Table2,
    title: 'Cobros y comprobantes en Excel',
    description:
      'Las transferencias se notifican por foto o mensaje. Conciliar quién pagó y quién no depende de revisión manual constante y propenso a errores.',
  },
  {
    icon: CalendarX,
    title: 'Reservas sin validación clara',
    description:
      'Las áreas comunes se gestionan con agendas físicas o grupos de chat. Los conflictos de horario y las aprobaciones informales generan fricciones repetidas.',
  },
];

export function LandingProblem() {
  return (
    <section id="problema" className="py-24 px-6 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow */}
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
        <p className="text-center text-slate-500 max-w-xl mx-auto mb-14 leading-relaxed">
          La mayoría de administradoras combinan WhatsApp, Excel y agendas en papel. El resultado
          es información dispersa, errores repetidos y residentes insatisfechos.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-white rounded-2xl border border-slate-100 p-7 flex flex-col items-center text-center lg:items-start lg:text-left">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-red-50 flex items-center justify-center mb-5 mx-auto lg:mx-0">
                <Icon className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
