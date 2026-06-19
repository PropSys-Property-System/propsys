import React from 'react';
import { AlertTriangle, Calendar, Receipt, Bell } from 'lucide-react';

const features = [
  {
    icon: AlertTriangle,
    color: 'bg-orange-50 text-orange-500',
    title: 'Gestión de Incidencias',
    description:
      'Los residentes reportan fallas con foto y descripción. El staff asigna, actualiza el estado y cierra el ticket. Cada cambio queda registrado con fecha y responsable.',
    tags: ['Ciclo de vida trazable', 'Evidencias adjuntas', 'Historial completo'],
  },
  {
    icon: Calendar,
    color: 'bg-blue-50 text-blue-500',
    title: 'Reservas de Áreas Comunes',
    description:
      'Los residentes solicitan espacios desde su panel. El administrador revisa y aprueba. El calendario muestra disponibilidad sin exponer datos de otros usuarios.',
    tags: ['Vista de calendario', 'Privacidad por rol', 'Aprobación manual'],
  },
  {
    icon: Receipt,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Recibos y Comprobantes',
    description:
      'El administrador emite recibos de mantenimiento. El residente sube su comprobante. El admin valida y registra el pago. El proceso es manual y supervisado — el humano decide.',
    tags: ['Almacenamiento privado', 'Validación manual', 'Registro por unidad'],
  },
  {
    icon: Bell,
    color: 'bg-violet-50 text-violet-600',
    title: 'Avisos y Comunicados',
    description:
      'Publica avisos segmentados por edificio, rol o unidad. Los residentes los ven en su panel sin necesidad de grupos de WhatsApp ni correos masivos sin contexto.',
    tags: ['Segmentación por edificio', 'Entrega inmediata', 'Sin intermediarios'],
  },
];

export function LandingFeatures() {
  return (
    <section id="producto" className="py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Eyebrow */}
        <div className="flex items-center gap-4 justify-center mb-5">
          <span className="h-px w-12 bg-slate-300 block" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
            Producto
          </span>
          <span className="h-px w-12 bg-slate-300 block" />
        </div>

        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-4">
          Todo lo que tu administración necesita, en un solo lugar.
        </h2>
        <p className="text-center text-slate-500 max-w-xl mx-auto mb-14 leading-relaxed">
          Módulos operativos diseñados para las tareas diarias reales de edificios y condominios.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map(({ icon: Icon, color, title, description, tags }) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-100 p-8 hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-6 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-5">{description}</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
