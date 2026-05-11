'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 overflow-hidden relative">
      {/* Elementos decorativos de fondo */}
      <div className="absolute top-1/4 -left-12 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-12 w-64 h-64 bg-slate-100 rounded-full blur-3xl"></div>
      
      <div className="text-center space-y-8 animate-in zoom-in-95 duration-700 relative z-10">
        <div className="relative inline-flex items-center justify-center">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse scale-150"></div>
          <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12 group hover:rotate-0 transition-transform duration-500">
            <ShieldAlert className="w-12 h-12 text-primary" />
          </div>
        </div>
        
        <div className="space-y-4">
          <h1 className="text-9xl font-black text-slate-900 tracking-tighter select-none">404</h1>
          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Página no encontrada</h2>
            <p className="text-slate-500 font-medium max-w-md mx-auto">
              Lo sentimos, la página que buscas no existe o ha sido movida. 
              Verifica la URL e intenta de nuevo.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link 
            href="/" 
            className="flex items-center bg-primary hover:bg-primary/90 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-primary/25 transition-all active:scale-95 group w-full sm:w-auto"
          >
            <Home className="w-5 h-5 mr-3 group-hover:-translate-y-1 transition-transform" />
            Volver al inicio
          </Link>
          <button 
            onClick={() => window.history.back()}
            className="flex items-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 px-8 rounded-2xl transition-all active:scale-95 group w-full sm:w-auto"
          >
            <ArrowLeft className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform" />
            Regresar
          </button>
        </div>
      </div>
      
      {/* Branding minimalista */}
      <div className="absolute bottom-12 flex flex-col items-center space-y-2">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.5em]">PropSys</span>
        <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          <span>Sistema en línea</span>
        </div>
      </div>
    </div>
  );
}

