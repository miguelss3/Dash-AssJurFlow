import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield, Lock, Mail, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoldierAvatar } from "@/components/SoldierAvatar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — AssJur Flow 12ª RM" },
      {
        name: "description",
        content: "Acesso restrito ao Sistema de Assessoria Jurídica da 12ª Região Militar.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, ready, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (ready && isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [ready, isAuthenticated, navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="text-sm font-medium text-slate-600">Sincronizando sessao...</p>
        </div>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    
    if (!email.trim() || !senha.trim()) {
      setErro("Informe o e-mail e senha.");
      return;
    }
    
    if (!email.includes("@")) {
      setErro("E-mail inválido.");
      return;
    }
    
    setLoading(true);
    
    try {
      await login(email.trim(), senha);
      navigate({ to: "/" });
    } catch (error: any) {
      console.error("Erro no login:", error);
      
      if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
        setErro("E-mail ou senha incorretos.");
      } else if (error.code === "auth/user-not-found") {
        setErro("Usuário não encontrado.");
      } else if (error.code === "auth/too-many-requests") {
        setErro("Muitas tentativas. Tente novamente mais tarde.");
      } else if (error.code === "auth/network-request-failed") {
        setErro("Sem conexão com o servidor de autenticação. Verifique sua internet ou tente pelo site: assjur-flow-12rm.web.app");
      } else {
        setErro("Erro ao autenticar. Verifique suas credenciais.");
      }
      
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-sidebar relative overflow-hidden">
      {/* Padrão decorativo */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 25% 25%, oklch(0.88 0.18 130) 1px, transparent 1px), radial-gradient(circle at 75% 75%, oklch(0.6 0.16 230) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[oklch(0.88_0.18_130)]/10 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[oklch(0.6_0.16_230)]/10 blur-3xl" />

      {/* Lado esquerdo — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 pt-12 pr-12 pb-12 pl-20 relative z-10 text-white">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[oklch(0.88_0.18_130)] flex items-center justify-center shadow-glow">
            <Shield className="h-6 w-6 text-[oklch(0.22_0.05_258)]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[oklch(0.88_0.18_130)] font-bold">
              Exército Brasileiro
            </p>
            <h2 className="text-lg font-bold">12ª Região Militar</h2>
          </div>
        </div>

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-semibold tracking-wider uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.88_0.18_130)] animate-pulse-soft" />
            Acesso Restrito
          </div>
          <h1 className="text-5xl font-bold leading-tight font-display">
            AssJur <span className="text-gradient-accent">Flow</span>
          </h1>
          <p className="text-lg text-white/70 max-w-md leading-relaxed">
            Sistema integrado de Assessoria Jurídica — controle de DU, PA, prazos e
            indicadores de produtividade.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4 max-w-md">
            {[
              { v: "100%", l: "Conformidade" },
              { v: "24/7", l: "Disponível" },
              { v: "RM12", l: "Operacional" },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3"
              >
                <p className="text-xl font-bold text-[oklch(0.88_0.18_130)]">{s.v}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div />
      </div>

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-3xl shadow-elegant border border-border p-8 lg:p-10 animate-fade-in-up">
            {/* Avatar soldado */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[oklch(0.88_0.18_130)]/30 blur-xl scale-110" />
                <div className="relative">
                  <SoldierAvatar size={96} className="drop-shadow-xl" />
                </div>
              </div>
              <h3 className="mt-5 text-2xl font-bold text-foreground font-display">
                Acesso ao Sistema
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Assessoria Jurídica da 12ª RM
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block"
                >
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@12rm.eb.mil.br"
                    className="h-11 pl-9 rounded-xl"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-senha"
                  className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block"
                >
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-senha"
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pl-9 rounded-xl"
                    disabled={loading}
                  />
                </div>
              </div>

              {erro && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-2.5 text-sm text-destructive">
                  {erro}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-accent text-[oklch(0.22_0.05_258)] hover:opacity-90 font-bold text-sm tracking-wide shadow-glow"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {loading ? "Autenticando..." : "Entrar no Sistema"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Para acesso, utilize suas credenciais do Firebase Authentication
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-white/50 mt-6">
            Sistema homologado &middot; Uso institucional &middot; v3.9
          </p>
          <p className="text-center text-[11px] text-white/30 mt-1">
            &copy; {new Date().getFullYear()} Maj Cav Miguel &mdash; AssJur Flow &middot; 12ª Região Militar
          </p>
        </div>
      </div>
    </div>
  );
}
