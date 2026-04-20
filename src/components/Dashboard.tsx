import { AlertTriangle, Clock, CalendarRange, Briefcase } from "lucide-react";
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

  const cards: Array<{
    key: FiltroPrazo;
    label: string;
    value: number;
    icon: typeof AlertTriangle;
    accent: string;
    bg: string;
  }> = [
    {
      key: "todos",
      label: "Total de processos",
      value: processos.length,
      icon: Briefcase,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
    {
      key: "vencidos",
      label: "Prazos vencidos",
      value: vencidos,
      icon: AlertTriangle,
      accent: "text-[var(--deadline-overdue)]",
      bg: "bg-[var(--deadline-overdue-bg)]",
    },
    {
      key: "hoje",
      label: "Vencem hoje",
      value: hoje,
      icon: Clock,
      accent: "text-[var(--deadline-today)]",
      bg: "bg-[var(--deadline-today-bg)]",
    },
    {
      key: "semana",
      label: "Próximos 7 dias",
      value: semana,
      icon: CalendarRange,
      accent: "text-[var(--deadline-soon)]",
      bg: "bg-[var(--deadline-soon-bg)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const active = filtro === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onFiltroChange(active ? "todos" : c.key)}
            className={`text-left rounded-xl border bg-card p-4 transition-[var(--transition-smooth)] hover:shadow-[var(--shadow-card)] ${
              active ? "border-primary ring-2 ring-primary/20" : "border-border"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`rounded-lg p-2 ${c.bg}`}>
                <Icon className={`h-4 w-4 ${c.accent}`} />
              </span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {c.value}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
          </button>
        );
      })}
    </div>
  );
}
