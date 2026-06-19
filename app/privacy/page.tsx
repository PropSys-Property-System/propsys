import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidad — PropSys',
  description: 'Cómo PropSys recopila, usa y protege la información de sus usuarios durante la beta controlada.',
};

export default function PrivacyPage() {
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
          Política de Privacidad
        </h1>
        <p className="text-sm text-slate-400 mb-12">
          Última actualización: junio de 2026 · Beta controlada
        </p>

        <div className="space-y-10">
          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">1. Quiénes somos</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              PropSys es una plataforma de gestión condominial desarrollada por{' '}
              <strong>Orbital Frameworks</strong>. Operamos en fase de beta controlada. Puedes
              contactarnos en{' '}
              <a
                href="mailto:contact.orbitalframeworks@gmail.com"
                className="text-primary hover:underline"
              >
                contact.orbitalframeworks@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              2. Qué información recopilamos
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Durante el uso de la plataforma, recopilamos la información que el administrador carga
              en el sistema: nombre y correo electrónico de usuarios, datos de edificios y unidades,
              reportes de incidencias, solicitudes de reserva y comprobantes de pago. No recopilamos
              información de pago con tarjeta de crédito directamente.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              3. Cómo usamos la información
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              La información se usa exclusivamente para proveer la funcionalidad de la plataforma:
              gestión de incidencias, reservas, comunicaciones internas y registro de comprobantes.
              No compartimos datos con terceros salvo requerimiento legal explícito.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">4. Aislamiento de datos</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Cada cliente (administradora) opera en un espacio completamente aislado. Sus datos no
              son accesibles para otros clientes de la plataforma. El acceso está restringido por
              roles y validado en cada solicitud a la base de datos.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">
              5. Almacenamiento de archivos
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Los comprobantes de pago y evidencias operativas se almacenan en servicios de nube
              seguros, bajo un prefijo exclusivo por cliente. El acceso a estos archivos se valida
              en cada solicitud a través de un proxy autenticado.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">6. Cookies y sesiones</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              PropSys utiliza cookies HttpOnly para gestionar sesiones autenticadas. No utilizamos
              cookies de seguimiento de terceros ni analítica de comportamiento de usuario en la
              versión actual.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">7. Derechos del usuario</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Puedes solicitar la eliminación de tus datos contactándonos en{' '}
              <a
                href="mailto:contact.orbitalframeworks@gmail.com"
                className="text-primary hover:underline"
              >
                contact.orbitalframeworks@gmail.com
              </a>
              . En fase beta, el proceso de eliminación se gestiona manualmente por el equipo de
              Orbital Frameworks.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-slate-900 mb-3">8. Cambios a esta política</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Esta política puede actualizarse a medida que la plataforma avance hacia producción.
              Notificaremos cambios significativos a los administradores activos.
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
