'use client';

import React, { useState } from 'react';
import { WizardStep } from '@/components/WizardStep';
import { Building2, User, CheckCircle2, ArrowRight, ArrowLeft, Loader2, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  
  const steps = ['Perfil', 'Propiedad', 'Confirmación'];

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      setIsLoading(true);
      // Simular guardado
      await new Promise(resolve => setTimeout(resolve, 1500));
      router.push('/router');
      return;
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col p-4 md:p-8">
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex-1 flex flex-col">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center">Configura tu cuenta</h1>
            <p className="text-slate-500 text-center mt-2 font-medium">Solo unos pasos para empezar con PropSys</p>
          </div>

          <WizardStep currentStep={currentStep} steps={steps} />

          <div className="flex-1 p-8 flex flex-col">
            {currentStep === 0 && (
              <div className="max-w-md mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Cuéntanos sobre ti</h2>
                  <p className="text-sm text-slate-500">Completa tu información básica de contacto.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Nombre Completo</label>
                    <input type="text" placeholder="Ej. Juan Pérez" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Teléfono</label>
                    <input type="tel" placeholder="+56 9 1234 5678" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="max-w-md mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Tu Propiedad</h2>
                  <p className="text-sm text-slate-500">Vincúlate a tu edificio y unidad correspondiente.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Edificio</label>
                    <select className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all appearance-none">
                      <option>Selecciona un edificio</option>
                      <option>Torre Alerce</option>
                      <option>Edificio Roble</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-wider ml-1">Unidad / Depto</label>
                    <input type="text" placeholder="Ej. 101" className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all" />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="max-w-md mx-auto w-full space-y-6 text-center animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">¡Todo listo!</h2>
                <p className="text-slate-500 font-medium">Hemos configurado tu perfil exitosamente. Ahora puedes acceder a tu panel personalizado en PropSys.</p>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumen</p>
                  <div className="flex items-center text-sm font-bold text-slate-700">
                    <User className="w-4 h-4 mr-2 text-primary" /> Perfil de Residente
                  </div>
                  <div className="flex items-center text-sm font-bold text-slate-700">
                    <Home className="w-4 h-4 mr-2 text-primary" /> Torre Alerce - Unidad 101
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 0 || isLoading}
              className="flex items-center px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 disabled:opacity-0 transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
            </button>
            <button
              onClick={handleNext}
              disabled={isLoading}
              className="flex items-center bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-70"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {currentStep === steps.length - 1 ? 'Finalizar' : 'Siguiente'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <span className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">PropSys</span>
        </div>
      </div>
    </div>
  );
}

