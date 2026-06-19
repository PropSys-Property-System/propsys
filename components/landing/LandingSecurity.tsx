import React from 'react';
import { LockKeyhole, Users2, HardDrive } from 'lucide-react';

const points = [
  {
    icon: LockKeyhole,
    title: 'Aislamiento total por cliente',
    description:
      'Cada administradora opera en un espacio completamente separado. Los datos de un cliente no son accesibles para otro. El aislamiento se aplica en cada consulta a la base de datos.',
  },
  {
    icon: Users2,
    title: 'Control de acceso por rol',
    description:
      'Las rutas y endpoints validan el rol del usuario en cada solicitud. Un residente no puede acceder a paneles de administración ni ver información de otras unidades.',
  },
  {
    icon: HardDrive,
    title: 'Archivos almacenados de forma privada',
    description:
      'Los comprobantes de pago y evidencias operativas se almacenan bajo un prefijo exclusivo por cliente, servidos solo a través de un proxy autenticado que valida permisos antes de entregar el archivo.',
  },
];

export function LandingSecurity() {
  return (
    <section id="seguridad" className="py-24 px-6 bg-slate-900">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow */}
        <div className="flex items-center gap-4 justify-center mb-5">
          <span className="h-px w-12 bg-slate-700 block" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-400">
            Seguridad y Privacidad
          </span>
          <span className="h-px w-12 bg-slate-700 block" />
        </div>

        <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight text-center mb-4">
          Diseñado con aislamiento de datos desde el inicio.
        </h2>
        <p className="text-center text-slate-400 max-w-xl mx-auto mb-14 leading-relaxed">
          PropSys aplica prácticas de seguridad técnica concretas en cada capa. No prometemos
          cumplimiento legal absoluto, pero sí un modelo de acceso estricto y auditado en cada rol.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {points.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-800/40 p-7">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-5">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-600 mt-10 max-w-lg mx-auto">
          PropSys está en beta controlada. Si tienes preguntas sobre seguridad o integración con tus
          sistemas, escríbenos a{' '}
          <a
            href="mailto:contact.orbitalframeworks@gmail.com"
            className="text-slate-400 hover:text-slate-300 underline transition-colors"
          >
            contact.orbitalframeworks@gmail.com
          </a>
        </p>
      </div>
    </section>
  );
}
