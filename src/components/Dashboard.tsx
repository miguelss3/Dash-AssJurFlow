import {
  AlertTriangle,
  Clock,
  CalendarRange,
  Briefcase,
  TrendingUp,
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
  const taxaConclusao =
    processos.length > 0 ? Math.round((concluidos / processos.length) * 100) : 0;

  type Tone = "primary" | "danger" | "warning" | "info";

  const cards: Array<{
    key: FiltroPrazo;
    label: string;
    value: number;
    sub: string;
    icon: typeof AlertTriangle;
    tone: Tone;
    extra?: string;
    isAccent?: boolean;
  }> = [
    {
      key: "todos",
      label: "Total de processos",
      value: processos.length,
      sub: `${ativos.length} ativos`,
      icon: Briefcase,
      tone: "primary",
      extra: `${taxaConclusao}% conclusão`,
      isAccent: true,
    },
    {
      key: "vencidos",
      label: "Vencidos",
      value: vencidos,
      sub: vencidos > 0 ? "ação imediata" : "tudo em dia",
      icon: AlertTriangle,
      tone: "danger",
    },
    {
      key: "hoje",
      label: "Vencem hoje",
      value: hoje,
      sub: hoje > 0 ? "priorizar" : "sem prazos",
      icon: Clock,
      tone: "warning",
    },
    {
      key: "semana",
      label: "Próximos 7 dias",
      value: semana,
      sub: "planejar semana",
      icon: CalendarRange,
      tone: "info",
    },
  ];

  const toneStyles: Record<Tone, { bg: string; text: string; ring: string }> = {
    primary: {
      bg: "bg-accent",
      text: "text-accent-foreground",
      ring: "ring-accent",
    },
    danger: {
      bg: "bg-[var(--deadline-overdue-bg)]",
      text: "text-[var(--deadline-overdue)]",
      ring: "ring-[var(--deadline-overdue)]",
    },
    warning: {
      bg: "bg-[var(--deadline-today-bg)]",
      text: "text-[var(--deadline-today)]",
      ring: "ring-[var(--deadline-today)]",
    },
    info: {
      bg: "bg-[var(--deadline-soon-bg)]",
      text: "text-[var(--deadline-soon)]",
      ring: "ring-[var(--deadline-soon)]",
    },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        const active = filtro === c.key;
        const styles = toneStyles[c.tone];
        const isAccent = c.isAccent;
        return (
          <button
            key={c.key}
            onClick={() => onFiltroChange(active ? "todos" : c.key)}
            style={{ animationDelay: `${i * 60}ms` }}
            className={`group text-left rounded-3xl border p-4 sm:p-5 transition-[var(--transition-smooth)] hover:-translate-y-0.5 hover:shadow-card-hover animate-fade-in-up ${
              isAccent
                ? "bg-accent border-accent text-accent-foreground"
                : "bg-card border-border"
            } ${active ? "ring-2 ring-offset-2 ring-offset-background ring-accent shadow-card-hover" : "shadow-card"}`}
          >
            <div className="flex items-start justify-between mb-3">
              <span
                className={`inline-flex h-10 w-10 rounded-2xl items-center justify-center ${
                  isAccent ? "bg-accent-foreground/10" : styles.bg
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${isAccent ? "text-accent-foreground" : styles.text}`}
                />
              </span>
              {active && (
                <span
                  className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                    isAccent
                      ? "bg-accent-foreground/15 text-accent-foreground"
                      : "bg-foreground/10 text-foreground"
                  }`}
                >
                  ativo
                </span>
              )}
            </div>

            <div
              className={`text-3xl sm:text-4xl font-bold tabular-nums tracking-tight font-display ${
                isAccent ? "text-accent-foreground" : "text-foreground"
              }`}
            >
              {c.value}
            </div>
            <p
              className={`text-sm font-bold mt-1 ${
                isAccent ? "text-accent-foreground" : "text-foreground"
              }`}
            >
              {c.label}
            </p>
            <p
              className={`text-[11px] mt-0.5 ${
                isAccent ? "text-accent-foreground/70" : "text-muted-foreground"
              }`}
            >
              {c.sub}
            </p>
            {c.extra && (
              <div
                className={`mt-3 pt-3 border-t flex items-center gap-1.5 text-[11px] font-semibold ${
                  isAccent
                    ? "border-accent-foreground/20 text-accent-foreground/80"
                    : "border-border text-muted-foreground"
                }`}
              >
                <TrendingUp className="h-3 w-3" />
                <span>{c.extra}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
