import React, { useState } from 'react';
import { useAuth } from '@/src/lib/auth';
import { theme } from '@/src/lib/theme';
import { Wrench, Mail, Lock, AlertCircle, Loader2, ShieldCheck, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import autoIllustration from '../assets/images/auto_service_illustration_1784844600246.jpg';

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
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative overflow-hidden font-sans">
      {/* Background Decorative Blur & Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-5xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl grid grid-cols-1 lg:grid-cols-12 relative z-10">
        {/* Left Visual Column */}
        <div className="lg:col-span-5 relative bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 p-8 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-amber-400 p-0.5 shadow-lg shadow-sky-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-sky-400" />
                </div>
              </div>
              <span className="text-xl font-black text-white tracking-tight">OficinaPro</span>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-400/20 text-sky-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                Plataforma de Gestão 2.0
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Controle total da sua oficina em um só lugar.
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Organize atendimentos, histórico por placa, peças, orçamentos e envie resumos profissionais direto para o WhatsApp do cliente.
              </p>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
              <img
                src={autoIllustration}
                alt="Digital Auto Repair"
                referrerPolicy="no-referrer"
                className="w-full h-44 object-cover filter brightness-95 group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>Fluxo de O.S. Inteligente</span>
                <span className="text-sky-400">#N1 no mercado</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800/60 hidden sm:block">
            <ul className="space-y-2 text-xs text-slate-400 font-medium">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Integração e importação de bancos de dados antigos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Geração instantânea de relatórios limpos em HTML e PDF</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-8 sm:p-10 lg:p-12 flex flex-col justify-center bg-slate-900/60">
          <div className="max-w-md mx-auto w-full space-y-6">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                {isSignUp ? 'Criar Nova Conta' : 'Acessar o Sistema'}
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {isSignUp
                  ? 'Informe seu e-mail para cadastrar um novo operador'
                  : 'Entre com suas credenciais de acesso à oficina'}
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-300 text-xs font-semibold animate-scale-up">
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
                    <span>Usar Conta de Teste Demonstração (Demo)</span>
                  </button>
                )}
              </div>
            </form>

            <div className="text-center pt-2">
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
      </div>
    </div>
  );
}

