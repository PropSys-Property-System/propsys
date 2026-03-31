'use client';

import React from 'react';
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/lib/auth/auth-context";
import { KPICard } from "@/components/KPICard";
import { 
  Receipt, 
  Users, 
  Building2, 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  ArrowRight,
  Download,
  Filter
} from 'lucide-react';
import Link from 'next/link';
import { MOCK_RECEIPTS } from '@/lib/mocks';
import { StatusBadge } from '@/components/Receipts';

export default function AdminDashboard() {
  const { user } = useAuth();

  const actions = (
    <div className="flex gap-2">
      <button className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
        <Download className="w-4 h-4 mr-2" /> Reporte Mensual
      </button>
      <button className="flex items-center px-4 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
        <Filter className="w-4 h-4 mr-2" /> Filtrar Vista
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader 
        title="Dashboard Administrativo" 
        description={`Bienvenido de nuevo, ${user?.name}. Aquí tienes un resumen de PropSys.`}
        actions={actions}
      />

      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPICard 
            title="Recaudación Mes" 
            value="$4.850.000" 
            icon={TrendingUp} 
            trend={{ value: 12, isUp: true }}
            variant="emerald"
            description="85% del total esperado"
          />
          <KPICard 
            title="Recibos Pendientes" 
            value="24" 
            icon={Receipt} 
            variant="amber"
            description="12 vencen esta semana"
          />
          <KPICard 
            title="Residentes Activos" 
            value="156" 
            icon={Users} 
            variant="primary"
            description="+4 este mes"
          />
          <KPICard 
            title="Incidencias" 
            value="3" 
            icon={AlertCircle} 
            variant="rose"
            description="2 de alta prioridad"
          />
        </div>

        {/* Middle Section: Charts & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Placeholder 1: Recaudación */}
          <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Flujo de Recaudación</h3>
                <p className="text-xs text-slate-400 font-medium">Comparativa de los últimos 6 meses</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center text-[10px] font-bold text-slate-400">
                  <span className="w-2 h-2 bg-primary rounded-full mr-1.5"></span> Esperado
                </div>
                <div className="flex items-center text-[10px] font-bold text-slate-400">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full mr-1.5"></span> Recaudado
                </div>
              </div>
            </div>
            
            <div className="flex-1 flex items-end justify-between px-4 pb-4">
              {[65, 80, 45, 90, 75, 85].map((val, i) => (
                <div key={i} className="flex flex-col items-center group w-full max-w-[40px]">
                  <div className="relative w-full flex flex-col items-center">
                    <div 
                      className="w-full bg-slate-100 rounded-t-lg transition-all duration-500 group-hover:bg-slate-200" 
                      style={{ height: '180px' }}
                    ></div>
                    <div 
                      className="absolute bottom-0 w-full bg-primary rounded-t-lg transition-all duration-700 shadow-lg shadow-primary/10 group-hover:bg-primary/90" 
                      style={{ height: `${val * 1.8}px` }}
                    ></div>
                  </div>
                  <span className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                    {['Oct', 'Nov', 'Dic', 'Ene', 'Feb', 'Mar'][i]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Sidebar */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Actividad Reciente</h3>
              <Link href="/admin/receipts" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Ver Todo</Link>
            </div>
            
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {MOCK_RECEIPTS.slice(0, 5).map((r, i) => (
                <div key={r.id} className="flex items-start space-x-4 group cursor-pointer">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-primary animate-pulse' : 'bg-slate-200'}`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate group-hover:text-primary transition-colors">{r.description}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-medium text-slate-400">{r.number}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                <Calendar className="w-3.5 h-3.5 mr-2 text-primary" /> Próxima Reunión
              </div>
              <p className="text-xs font-bold text-slate-700">Comité de Administración</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">Jueves 02 de Abril, 19:00 hrs</p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Quick Links or Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/admin/receipts" className="p-6 bg-primary text-white rounded-[2rem] shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all group overflow-hidden relative">
            <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
              <Receipt className="w-32 h-32" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-black uppercase tracking-widest">Emitir Recibos</h4>
                <p className="text-xs text-white/80 font-medium mt-1">Generar cobros para el próximo periodo</p>
              </div>
              <div className="flex items-center text-[10px] font-black uppercase tracking-widest">
                Comenzar <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-2 transition-transform" />
              </div>
            </div>
          </Link>

          <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Estado Edificios</h4>
                <p className="text-xs text-slate-400 font-medium mt-1">2 de 2 edificios al día con mantenciones</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-6 overflow-hidden">
              <div className="bg-emerald-500 h-full w-[100%] rounded-full"></div>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Ocupación</h4>
                <p className="text-xs text-slate-400 font-medium mt-1">94% de las unidades habitadas</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-6 overflow-hidden">
              <div className="bg-amber-500 h-full w-[94%] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Branding PropSys */}
      <div className="py-8 text-center">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.5em]">PropSys Dashboard</span>
      </div>
    </div>
  );
}
