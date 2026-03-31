import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface WizardStepProps {
  currentStep: number;
  steps: string[];
}

export function WizardStep({ currentStep, steps }: WizardStepProps) {
  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between max-w-2xl mx-auto px-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          
          return (
            <React.Fragment key={step}>
              {/* Step Circle */}
              <div className="flex flex-col items-center relative z-10 group">
                <div className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all duration-300",
                  isCompleted 
                    ? "bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20" 
                    : isActive 
                      ? "bg-white border-primary text-primary scale-110 shadow-lg shadow-primary/10 ring-4 ring-primary/5" 
                      : "bg-white border-slate-200 text-slate-400"
                )}>
                  {isCompleted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={cn(
                  "absolute -bottom-6 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors duration-300",
                  isActive ? "text-primary" : "text-slate-400"
                )}>
                  {step}
                </span>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 bg-slate-100 relative -top-3">
                  <div 
                    className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-in-out shadow-sm shadow-primary/20"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
