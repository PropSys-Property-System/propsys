import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';

type ResetPasswordRequestViewProps = {
  email: string;
  isLoading: boolean;
  onEmailChange: (email: string) => void;
  onSubmit: (event: React.FormEvent) => void | Promise<void>;
};

type ResetPasswordSuccessViewProps = {
  email: string;
};

export function ResetPasswordShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-10 shadow-2xl rounded-3xl border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-primary"></div>
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Recuperar Acceso</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">PropSys - Seguridad de Cuenta</p>
        </div>

        {children}
      </div>

      <div className="mt-12 text-center">
        <span className="text-xs font-black text-slate-300 uppercase tracking-[0.4em]">PropSys</span>
      </div>
    </div>
  );
}

export function ResetPasswordRequestView({
  email,
  isLoading,
  onEmailChange,
  onSubmit,
}: ResetPasswordRequestViewProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 font-medium text-center">
          Ingresa tu correo electronico y te enviaremos las instrucciones para restablecer tu contrasena.
        </p>

        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="email"
            required
            placeholder="Tu correo electronico"
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-primary/25 flex items-center justify-center space-x-3 transition-all active:scale-[0.98] disabled:opacity-70 group"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>Enviar instrucciones</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <Link
          href="/"
          className="flex items-center justify-center text-xs font-black text-slate-400 hover:text-slate-600 transition-colors py-2 uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3 mr-2" /> Volver al inicio
        </Link>
      </div>
    </form>
  );
}

export function ResetPasswordSuccessView({ email }: ResetPasswordSuccessViewProps) {
  return (
    <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Correo enviado</h2>
        <p className="text-slate-500 font-medium max-w-xs mx-auto text-sm">
          Revisa la bandeja de entrada de <span className="text-primary font-bold">{email}</span> para continuar.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 font-black py-4 px-8 rounded-2xl transition-all active:scale-[0.98] w-full"
      >
        Volver al Login
      </Link>
    </div>
  );
}
