import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Shield, Lock, User, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SoldierAvatar } from "@/components/SoldierAvatar";

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
  beforeLoad: () => {
    if (typeof window !== "undefined" && window.localStorage.getItem("assjur:auth")) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

const PERFIS = [
  { posto: "Maj", nome: "Miguel", role: "MAJ - ADMIN UNIVERSAL", secao: "AssJur" },
  { posto: "Ten", nome: "Becker", role: "TEN - ASSESSOR", secao: "SFPC" },
  { posto: "TC", nome: "Perninha", role: "TC - ASSESSOR", secao: "SVP" },
] as const;

function LoginPage() {
  const navigate = useNavigate();
  const [posto, setPosto] = useState("Maj");
  const [nome, setNome] = useState("Miguel");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!nome.trim() || !senha.trim()) {
      setErro("Informe nome de guerra e senha.");
      return;
    }
    setLoading(true);
    // Mock — qualquer senha autentica. Substituir por Lovable Cloud.
    const perfil =
      PERFIS.find((p) => p.nome.toLowerCase() === nome.trim().toLowerCase()) ?? {
        posto,
        nome: nome.trim(),
        role: `${posto.toUpperCase()} - ASSESSOR`,
        secao: "AssJur",
      };
    setTimeout(() => {
      window.localStorage.setItem("assjur:auth", JSON.stringify({ ...perfil, posto }));
      navigate({ to: "/" });
    }, 400);
  };

  const escolherPerfil = (p: (typeof PERFIS)[number]) => {
    setPosto(p.posto);
    setNome(p.nome);
    setSenha("12rm");
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
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative z-10 text-white">
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

        <p className="text-xs text-white/40">
          © 2026 Comando da 12ª Região Militar — Todos os direitos reservados.
        </p>
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
                Identificação Militar
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Acesse com seu posto e nome de guerra
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Posto
                  </label>
                  <select
                    value={posto}
                    onChange={(e) => setPosto(e.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {["Cel", "TC", "Maj", "Cap", "Ten", "Sgt", "Cb", "Sd"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Nome de Guerra
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="ex. Miguel"
                      className="h-11 pl-9 rounded-xl"
                      autoComplete="username"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pl-9 rounded-xl"
                    autoComplete="current-password"
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

            {/* Perfis demo */}
            <div className="mt-7 pt-6 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">
                Acesso rápido (demo)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PERFIS.map((p) => (
                  <button
                    key={p.nome}
                    type="button"
                    onClick={() => escolherPerfil(p)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border hover:border-[oklch(0.88_0.18_130)] hover:bg-[oklch(0.88_0.18_130)]/5 transition-all group"
                  >
                    <SoldierAvatar size={32} />
                    <span className="text-[10px] font-bold text-foreground">
                      {p.posto} {p.nome}
                    </span>
                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                      {p.secao}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-white/50 mt-6">
            Sistema homologado · Uso institucional · v3.2
          </p>
        </div>
      </div>
    </div>
  );
}
