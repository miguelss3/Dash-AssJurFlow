import { AlertTriangle, Clock, CalendarRange, Briefcase, TrendingUp, TrendingDown } from "lucide-react";
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
    value: number | string;
    sub: string;
    icon: typeof AlertTriangle;
    accent: string;
    iconBg: string;
    glow: string;
    trend?: { up: boolean; text: string };
  }> = [
    {
      key: "todos",
      label: "Total de processos",
      value: processos.length,
      sub: `${ativos.length} em andamento`,
      icon: Briefcase,
      accent: "text-primary-glow",
      iconBg: "bg-primary/10",
      glow: "from-primary-glow/20",
      trend: { up: true, text: `${taxaConclusao}% concluídos` },
    },
    {
      key: "vencidos",
      label: "Prazos vencidos",
      value: vencidos,
      sub: "Requer ação imediata",
      icon: AlertTriangle,
      accent: "text-[var(--deadline-overdue)]",
      iconBg: "bg-[var(--deadline-overdue-bg)]",
      glow: "from-[var(--deadline-overdue)]/20",
      trend: vencidos > 0 ? { up: false, text: "Atenção urgente" } : undefined,
    },
    {
      key: "hoje",
      label: "Vencem hoje",
      value: hoje,
      sub: hoje > 0 ? "Priorizar agenda" : "Nenhum prazo hoje",
      icon: Clock,
      accent: "text-[var(--deadline-today)]",
      iconBg: "bg-[var(--deadline-today-bg)]",
      glow: "from-[var(--deadline-today)]/20",
    },
    {
      key: "semana",
      label: "Próximos 7 dias",
      value: semana,
      sub: "Planejar a semana",
      icon: CalendarRange,
      accent: "text-[var(--deadline-soon)]",
      iconBg: "bg-[var(--deadline-soon-bg)]",
      glow: "from-[var(--deadline-soon)]/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const active = filtro === c.key;
        const Trend = c.trend?.up ? TrendingUp : TrendingDown;
        return (
          <button
            key={c.key}
            onClick={() => onFiltroChange(active ? "todos" : c.key)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`group relative text-left rounded-2xl border bg-card p-4 sm:p-5 overflow-hidden transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 animate-fade-in-up ${
              active
                ? "border-primary/60 ring-2 ring-primary/30 shadow-[var(--shadow-card-hover)]"
                : "border-border shadow-[var(--shadow-card)]"
            }`}
          >
            {/* Glow decorativo */}
            <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${c.glow} to-transparent blur-2xl opacity-70 transition-opacity group-hover:opacity-100`} />

            <div className="relative flex items-start justify-between mb-3">
              <span className={`rounded-xl p-2.5 ${c.iconBg}`}>
                <Icon className={`h-5 w-5 ${c.accent}`} />
              </span>
              {c.trend && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${c.trend.up ? "text-[var(--deadline-safe)]" : "text-[var(--deadline-overdue)]"}`}>
                  <Trend className="h-3 w-3" />
                  {c.trend.text}
                </span>
              )}
            </div>

            <div className="relative">
              <div className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground tracking-tight">
                {c.value}
              </div>
              <p className="text-xs sm:text-sm text-foreground font-semibold mt-1">
                {c.label}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
