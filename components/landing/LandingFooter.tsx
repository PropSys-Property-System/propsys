import React from 'react';
import Link from 'next/link';
import { Building2, Instagram, Globe, Mail } from 'lucide-react';

const DEMO_HREF =
  'mailto:contact.orbitalframeworks@gmail.com?subject=Demo%20PropSys%20-%20Solicitud%20de%20informaci%C3%B3n';

const currentYear = new Date().getFullYear();

export function LandingFooter() {
  return (
    <footer className="bg-white border-t border-slate-100 py-14 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-5 h-5 text-primary" />
              <span className="font-black text-slate-900">PropSys</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              Plataforma de gestión condominial en beta controlada. Centraliza operaciones, mejora
              trazabilidad y reduce procesos manuales.
            </p>
            <p className="text-xs text-slate-400">
              Desarrollado por{' '}
              <a
                href="https://orbitalframeworks.qzz.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                Orbital Frameworks
              </a>
            </p>
          </div>

          {/* Plataforma links */}
          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">
              Plataforma
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#producto"
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Características
                </a>
              </li>
              <li>
                <a
                  href="#roles"
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Roles y accesos
                </a>
              </li>
              <li>
                <a
                  href="#seguridad"
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Seguridad
                </a>
              </li>
              <li>
                <a
                  href="#faq"
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  FAQ
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Acceso clientes
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-4">
              Contacto
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={DEMO_HREF}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  Solicitar demo
                </a>
              </li>
              <li>
                <a
                  href="https://orbitalframeworks.qzz.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                  orbitalframeworks.qzz.io
                </a>
              </li>
              <li>
                <a
                  href="https://www.instagram.com/orbitalframeworkspe/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <Instagram className="w-4 h-4 text-slate-400 shrink-0" />
                  @orbitalframeworkspe
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            © {currentYear} Orbital Frameworks. PropSys está en beta controlada.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Privacidad
            </Link>
            <Link
              href="/terms"
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Términos
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
