import React from "react";
import { cn } from "@/lib/utils";

export function GlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("group relative rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl p-8 overflow-hidden transition-all hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10", className)}>
      {/* Background radial glow that follows mouse (simplified via CSS group-hover for pure CSS approach) */}
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-50/0 via-indigo-50/0 to-indigo-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}
