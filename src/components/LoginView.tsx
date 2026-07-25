import React, { useState } from 'react';
import { useAuth } from '@/src/lib/auth';
import { Wrench, Mail, Lock, AlertCircle, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

export default function LoginView() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) throw new Error(signUpError);
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) throw new Error(signInError);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@oficinapro.com');
    setPassword('123456');
    setIsSignUp(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background Decorative Blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl shadow-2xl p-8 sm:p-10 backdrop-blur-xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-sky-400 p-0.5 shadow-lg shadow-sky-500/20 mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Wrench className="w-6 h-6 text-sky-400" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">OficinaPro</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 text-center">
            {isSignUp
              ? 'Informe seu e-mail para cadastrar um novo operador'
              : 'Entre com suas credenciais de acesso à oficina'}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-300 text-xs font-semibold mb-6 animate-scale-up">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              E-mail do Operador
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
                placeholder="operador@oficinapro.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase tracking-wider">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl text-sm font-black text-slate-950 bg-sky-400 hover:bg-sky-300 transition-all shadow-lg shadow-sky-500/20 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isSignUp ? (
                'Finalizar Cadastro'
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {!isSignUp && (
              <button
                type="button"
                onClick={handleFillDemo}
                className="w-full py-3 px-4 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-extrabold hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Usar Conta de Teste Demonstração</span>
              </button>
            )}
          </div>
        </form>

        <div className="text-center pt-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs font-bold text-sky-400 hover:text-sky-300 hover:underline transition-colors cursor-pointer"
          >
            {isSignUp ? 'Já tem uma conta? Clique aqui para entrar' : 'Não tem conta ainda? Cadastre-se em segundos'}
          </button>
        </div>
      </div>
    </div>
  );
}

