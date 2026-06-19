'use client';

import React, { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqs = [
  {
    q: '¿Cómo se configura PropSys para mi administración?',
    a: 'Un especialista de Orbital Frameworks te acompaña en el proceso inicial: creamos los edificios, registramos las unidades y te entregamos los links de invitación para tu equipo. El proceso toma horas, no semanas.',
  },
  {
    q: '¿Los residentes necesitan instalar una aplicación?',
    a: 'No. PropSys funciona completamente desde el navegador web. Los residentes reciben un link de invitación, definen su contraseña y acceden directamente. Sin descarga, sin tienda de aplicaciones.',
  },
  {
    q: '¿Los datos de mis clientes están separados de los de otras administradoras?',
    a: 'Sí. Cada administradora opera en un espacio completamente aislado. A nivel de base de datos y almacenamiento, los datos están particionados por cliente. Un usuario de un edificio no puede ver ni acceder a la información de otro.',
  },
  {
    q: '¿PropSys procesa pagos con tarjeta de crédito?',
    a: 'En la versión actual, la plataforma facilita la validación manual de comprobantes: el residente sube la foto del comprobante y el administrador lo aprueba. El procesamiento automático de tarjetas está en el roadmap, fuera del alcance de la beta actual.',
  },
  {
    q: '¿Está disponible en mi país?',
    a: 'PropSys está en fase de beta controlada. Escríbenos a contact.orbitalframeworks@gmail.com para validar disponibilidad y plazos en tu región.',
  },
];

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        {/* Eyebrow */}
        <div className="flex items-center gap-4 justify-center mb-5">
          <span className="h-px w-12 bg-slate-300 block" />
          <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
            Preguntas Frecuentes
          </span>
          <span className="h-px w-12 bg-slate-300 block" />
        </div>

        <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight text-center mb-14">
          Respuestas directas.
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="border border-slate-100 rounded-2xl overflow-hidden">
              <button
                id={`faq-item-${i}`}
                className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-bold text-slate-900 pr-4">{faq.q}</span>
                {open === i ? (
                  <Minus className="w-4 h-4 text-slate-400 shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </button>
              {open === i && (
                <div className="px-6 pb-5 border-t border-slate-50">
                  <p className="pt-4 text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
