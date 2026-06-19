import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Términos de Uso — PropSys',
  description:
    'Términos y condiciones de uso de la plataforma PropSys en su fase de beta controlada.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal header */}
      <header className="border-b border-slate-100 py-4 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="font-black text-slate-900">PropSys</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">Legal</p>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
          Términos de Uso
        </h1>
        <p className="text-sm text-slate-400 mb-12">
          Última actualización: junio de 2026 · Beta controlada
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              1. Aceptación de los términos
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Al acceder y usar PropSys, aceptas estos términos. Si estás usando la plataforma en
              nombre de una organización, representas que tienes autorización para aceptar estos
              términos en su nombre.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              2. Descripción del servicio
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              PropSys es una plataforma de gestión condominial en fase de beta controlada,
              desarrollada por Orbital Frameworks. Durante la beta, el servicio puede presentar
              interrupciones, cambios de funcionalidad o pérdida de datos en entornos no productivos
              configurados sin almacenamiento persistente.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">3. Uso aceptable</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              La plataforma está destinada exclusivamente a la gestión administrativa de edificios y
              condominios. No está permitido usar PropSys para actividades ilegales, procesamiento
              de datos personales de terceros sin consentimiento, o cualquier actividad que
              comprometa la seguridad del sistema.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              4. Limitaciones del servicio en beta
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              PropSys en su versión actual <strong>no</strong> procesa pagos con tarjeta de crédito,
              no ofrece facturación fiscal automatizada, no garantiza SLAs de disponibilidad ni
              proporciona cumplimiento legal contable automático. La validación de pagos es manual y
              requiere supervisión humana.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              5. Datos y responsabilidad
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              El administrador de cada cuenta es responsable de la exactitud y legalidad de los
              datos cargados en la plataforma, incluyendo información de residentes, montos y
              comprobantes. Orbital Frameworks no valida la veracidad de los documentos cargados.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">6. Suspensión de acceso</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Orbital Frameworks se reserva el derecho de suspender el acceso a clientes que
              incumplan estos términos, sin previo aviso en casos de abuso grave del sistema.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">7. Modificaciones</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Estos términos pueden cambiar a medida que la plataforma evolucione. Los cambios
              significativos serán comunicados a los administradores activos con antelación razonable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">8. Contacto</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Para consultas sobre estos términos, escríbenos a{' '}
              <a
                href="mailto:contact.orbitalframeworks@gmail.com"
                className="text-primary hover:underline"
              >
                contact.orbitalframeworks@gmail.com
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-slate-100">
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  );
}
