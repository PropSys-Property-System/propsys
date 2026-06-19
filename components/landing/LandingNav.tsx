'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Building2 } from 'lucide-react';

const DEMO_HREF =
  'mailto:contact.orbitalframeworks@gmail.com?subject=Demo%20PropSys%20-%20Solicitud%20de%20informaci%C3%B3n';

export function LandingNav() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { href: '#producto', label: 'Producto' },
    { href: '#flujo', label: 'Cómo funciona' },
    { href: '#roles', label: 'Roles' },
    { href: '#seguridad', label: 'Seguridad' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-sm border-b border-slate-100 shadow-sm'
          : 'bg-white border-b border-slate-100'
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Building2 className="w-5 h-5 text-primary transition-transform group-hover:scale-105" />
          <span className="font-black text-lg text-slate-900 tracking-tight">PropSys</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            Iniciar sesión
          </Link>
          <a
            href={DEMO_HREF}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
          >
            Solicitar demo
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          id="landing-mobile-menu-toggle"
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Abrir menú de navegación"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-slate-100 px-6 py-4 space-y-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setIsOpen(false)}
              className="block text-sm font-medium text-slate-700 hover:text-slate-900 py-2.5"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-3 mt-1">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-500 py-2"
              onClick={() => setIsOpen(false)}
            >
              Iniciar sesión
            </Link>
            <a
              href={DEMO_HREF}
              className="inline-flex justify-center items-center px-5 py-3 rounded-xl bg-primary text-white text-sm font-bold"
            >
              Solicitar demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
