import {
  AlertTriangle,
  Clock,
  CalendarRange,
  Briefcase,
  TrendingUp,
  Activity,
} from "lucide-react";
import type { Processo, FiltroPrazo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  filtro: FiltroPrazo;
  onFiltroChange: (f: FiltroPrazo) => void;
}

export function Dashboard({ processos, filtro, onFiltroChange }: Props) {
  const ativos = processos.filter((p) => p.status !== "concluido");
  const vencidos = ativos.filter((p) => statusPrazo(p.prazo) === "overdue").length;
  const hoje = ativos.filter((p) => statusPrazo(p.prazo) === "today").length;
  const semana = ativos.filter((p) => {
    const s = statusPrazo(p.prazo);
    return s === "today" || s === "soon";
  }).length;
  const concluidos = processos.filter((p) => p.status === "concluido").length;
  const taxaConclusao = processos.length > 0 ? Math.round((concluidos / processos.length) * 100) : 0;

  const cards: Array<{
    key: FiltroPrazo;
    label: string;
    code: string;
    value: number | string;
    sub: string;
    icon: typeof AlertTriangle;
    color: string;
    extra?: string;
  }> = [
    {
      key: "todos",
      label: "Total",
      code: "TOT",
      value: processos.length,
      sub: `${ativos.length} ativos`,
      icon: Briefcase,
      color: "oklch(0.78 0.16 220)",
      extra: `${taxaConclusao}% conclusão`,
    },
    {
      key: "vencidos",
      label: "Vencidos",
      code: "OVR",
      value: vencidos,
      sub: vencidos > 0 ? "ação imediata" : "tudo em dia",
      icon: AlertTriangle,
      color: "oklch(0.72 0.24 22)",
    },
    {
      key: "hoje",
      label: "Hoje",
      code: "TDY",
      value: hoje,
      sub: hoje > 0 ? "priorizar" : "sem prazos",
      icon: Clock,
      color: "oklch(0.82 0.2 60)",
    },
    {
      key: "semana",
      label: "7 dias",
      code: "WK",
      value: semana,
      sub: "planejar semana",
      icon: CalendarRange,
      color: "oklch(0.85 0.18 95)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const active = filtro === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onFiltroChange(active ? "todos" : c.key)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`group relative text-left rounded-xl border bg-card/60 backdrop-blur p-4 sm:p-5 overflow-hidden transition-[var(--transition-smooth)] hover:-translate-y-0.5 animate-fade-in-up ${
              active
                ? "border-primary/60 ring-2 ring-primary/30 shadow-glow"
                : "border-border hover:border-primary/30 hover:shadow-[var(--shadow-card-hover)]"
            }`}
          >
            {/* Glow */}
            <div
              className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"
              style={{ background: `radial-gradient(circle, ${c.color} 0%, transparent 70%)` }}
            />
            {/* Grid pattern */}
            <div className="pointer-events-none absolute inset-0 pattern-grid-sm opacity-30" />

            {/* Top: code + icon */}
            <div className="relative flex items-start justify-between mb-3">
              <span
                className="text-[10px] font-mono-tech font-bold tracking-[0.2em] uppercase"
                style={{ color: c.color }}
              >
                {c.code}_
              </span>
              <span
                className="rounded-lg p-2 border"
                style={{
                  backgroundColor: `color-mix(in oklab, ${c.color} 12%, transparent)`,
                  borderColor: `color-mix(in oklab, ${c.color} 30%, transparent)`,
                }}
              >
                <Icon className="h-4 w-4" style={{ color: c.color }} />
              </span>
            </div>

            <div className="relative">
              <div
                className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight font-mono-tech"
                style={{ color: c.color, textShadow: `0 0 24px ${c.color}40` }}
              >
                {c.value}
              </div>
              <p className="text-[13px] text-foreground font-semibold mt-1">{c.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono-tech uppercase tracking-wider">
                {c.sub}
              </p>
              {c.extra && (
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <TrendingUp className="h-3 w-3" style={{ color: c.color }} />
                  <span>{c.extra}</span>
                </div>
              )}
            </div>

            {active && (
              <div className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-mono-tech text-primary">
                <Activity className="h-2.5 w-2.5 animate-pulse" />
                LIVE
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
