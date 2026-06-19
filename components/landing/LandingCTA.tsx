import React from 'react';
import { ArrowRight, Mail, CalendarCheck2 } from 'lucide-react';

const DEMO_HREF =
  'mailto:contact.orbitalframeworks@gmail.com?subject=Demo%20PropSys%20-%20Solicitud%20de%20informaci%C3%B3n';

const checks = [
  'Revisamos tu operación actual',
  'Te mostramos PropSys en vivo',
  'Evaluamos si encaja con tu contexto',
  'Sin compromiso ni proceso complicado',
];

export function LandingCTA() {
  return (
    <section className="py-24 px-6 bg-slate-900">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          {/* Left: copy */}
          <div>
            <div className="flex items-center gap-4 mb-6">
              <span className="h-px w-8 bg-slate-700 block" />
              <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
                Demo personalizada
              </span>
            </div>

            <h2 className="text-3xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              Agenda una demo y revisemos si PropSys encaja con tu operación.
            </h2>

            <p className="text-slate-400 leading-relaxed mb-8">
              PropSys está en beta controlada. No es un producto masivo: trabajamos con
              administradoras de forma directa. Si te interesa, hablemos. Evaluamos juntos si encaja
              con tu operación antes de cualquier compromiso.
            </p>

            <ul className="space-y-3 mb-10">
              {checks.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <CalendarCheck2 className="w-4 h-4 text-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                id="footer-demo-cta"
                href={DEMO_HREF}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-primary text-white font-black text-sm tracking-wide shadow-xl shadow-primary/30 hover:bg-primary/90 transition-all active:scale-[0.98]"
              >
                <Mail className="w-4 h-4" />
                Solicitar demo
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <p className="mt-5 text-xs text-slate-600">
              O escríbenos a{' '}
              <a
                href="mailto:contact.orbitalframeworks@gmail.com"
                className="text-slate-400 hover:text-slate-300 underline transition-colors"
              >
                contact.orbitalframeworks@gmail.com
              </a>
            </p>
          </div>

          {/* Right: visual — what to expect from a demo */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4">
              Qué esperar de la demo
            </p>
            {[
              {
                n: '01',
                title: 'Revisión de tu contexto',
                body: 'Contanos cuántos edificios gestionas, cómo es tu equipo y qué procesos quieres ordenar primero.',
              },
              {
                n: '02',
                title: 'Recorrido en vivo por PropSys',
                body: 'Mostramos el panel real: incidencias, reservas, recibos y staff. Sin demos pregrabadas.',
              },
              {
                n: '03',
                title: 'Evaluación honesta',
                body: 'Si PropSys encaja con tu operación, lo vemos juntos. Si no encaja todavía, también te lo decimos.',
              },
            ].map((item) => (
              <div
                key={item.n}
                className="flex gap-4 bg-slate-800/50 rounded-2xl border border-slate-800 p-5"
              >
                <span className="text-2xl font-black text-slate-700 shrink-0 leading-none mt-0.5">
                  {item.n}
                </span>
                <div>
                  <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
