import {
  AlertTriangle,
  Clock,
  CalendarRange,
  TrendingUp,
  Trophy,
  Zap,
  CheckCircle2,
  Inbox,
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
  const total = processos.length;
  const totalAtos = total + concluidos * 3 + ativos.length * 2; // mock produtividade
  const movimentacoes = ativos.length * 3;
  const indiceResolutividade =
    total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const temposReatividadeHoras = processos
    .filter((p) => Boolean((p.responsavel || "").trim()))
    .map((p) => {
      const inicioBruto = p.criadoEm || p.dataEntrada;
      const fimBruto = p.atualizadoEm || p.criadoEm;
      const inicio = inicioBruto ? new Date(inicioBruto) : null;
      const fim = fimBruto ? new Date(fimBruto) : null;
      if (!inicio || !fim) return null;
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;
      const horas = (fim.getTime() - inicio.getTime()) / (1000 * 60 * 60);
      return horas >= 0 ? horas : null;
    })
    .filter((h): h is number => typeof h === "number");

  const mediaReatividadeHoras =
    temposReatividadeHoras.length > 0
      ? temposReatividadeHoras.reduce((acc, h) => acc + h, 0) / temposReatividadeHoras.length
      : null;

  const taxaReatividade =
    mediaReatividadeHoras !== null
      ? `${mediaReatividadeHoras.toFixed(1).replace(".", ",")} h`
      : "--";

  const casosAte24h = temposReatividadeHoras.filter((h) => h <= 24).length;
  const percentualAte24h =
    temposReatividadeHoras.length > 0
      ? Math.round((casosAte24h / temposReatividadeHoras.length) * 100)
      : 0;

  return (
    <div className="space-y-4">
      {/* === HERO BANNER: Produtividade Acumulada (estilo AssJur) === */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-[oklch(0.22_0.05_258)] to-[oklch(0.32_0.1_245)] text-white p-6 shadow-elegant relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[oklch(0.6_0.16_230)]/30 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[oklch(0.78_0.18_145)] flex items-center gap-1.5 mb-3">
                <Trophy className="h-3 w-3" />
                Produtividade Acumulada
              </p>
              <div className="text-6xl font-bold font-display tabular-nums leading-none">
                {totalAtos}
              </div>
              <p className="text-sm text-white/70 mt-3 max-w-md">
                Total de atos jurídicos processados no sistema.
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm min-w-[180px]">
              <p className="text-[9px] uppercase tracking-wider text-white/50 font-bold mb-2">
                Composição
              </p>
              <ul className="text-xs space-y-1.5 font-medium">
                <li className="flex justify-between gap-3">
                  <span className="text-white/70">Processos:</span>
                  <span className="font-bold tabular-nums">{total}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-white/70">Movimentações:</span>
                  <span className="font-bold tabular-nums">{movimentacoes}</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-white/70">Mensagens:</span>
                  <span className="font-bold tabular-nums">0</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Reatividade */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex h-8 w-8 rounded-lg bg-[oklch(0.7_0.17_50_/_0.15)] items-center justify-center">
              <Zap className="h-4 w-4 text-[oklch(0.7_0.17_50)]" />
            </span>
            <p className="text-[10px] uppercase tracking-wider font-bold text-foreground">
              Taxa de Reatividade
            </p>
          </div>
          <div className="text-4xl font-bold font-display text-foreground tabular-nums">
            {taxaReatividade}
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-snug">
            Tempo médio do cadastro até a mesa do assessor.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-[var(--deadline-safe-bg)] text-[var(--deadline-safe)]">
              {percentualAte24h}% em até 24h
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-muted text-muted-foreground">
              {temposReatividadeHoras.length} apuradas
            </span>
          </div>
        </div>
      </div>

      {/* === KPIs do mês === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="Entradas no mês"
          value={total - concluidos}
          icon={Inbox}
          tone="blue"
          active={false}
          onClick={() => onFiltroChange("todos")}
        />
        <KpiCard
          label="Conclusões no mês"
          value={concluidos}
          icon={CheckCircle2}
          tone="green"
          active={false}
        />
        <KpiCard
          label="Índice de Resolutividade"
          value={`${indiceResolutividade}%`}
          icon={TrendingUp}
          tone="purple"
          active={false}
        />
        <KpiCard
          label="Acervo Total"
          value={ativos.length}
          icon={Trophy}
          tone="amber"
          active={false}
        />
      </div>

      {/* === KPIs de prazo (clicáveis para filtrar) === */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Vencidos"
          value={vencidos}
          sub={vencidos > 0 ? "ação imediata" : "tudo em dia"}
          icon={AlertTriangle}
          tone="red"
          active={filtro === "vencidos"}
          onClick={() => onFiltroChange(filtro === "vencidos" ? "todos" : "vencidos")}
        />
        <KpiCard
          label="Vencem Hoje"
          value={hoje}
          sub={hoje > 0 ? "priorizar" : "sem prazos"}
          icon={Clock}
          tone="amber"
          active={filtro === "hoje"}
          onClick={() => onFiltroChange(filtro === "hoje" ? "todos" : "hoje")}
        />
        <KpiCard
          label="Próximos 7 dias"
          value={semana}
          sub="planejar semana"
          icon={CalendarRange}
          tone="blue"
          active={filtro === "semana"}
          onClick={() => onFiltroChange(filtro === "semana" ? "todos" : "semana")}
        />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof AlertTriangle;
  tone: "blue" | "green" | "purple" | "amber" | "red";
  active: boolean;
  onClick?: () => void;
}) {
  const tones: Record<string, { bg: string; text: string }> = {
    blue: { bg: "bg-[oklch(0.6_0.16_230_/_0.12)]", text: "text-[oklch(0.55_0.17_230)]" },
    green: { bg: "bg-[var(--deadline-safe-bg)]", text: "text-[var(--deadline-safe)]" },
    purple: { bg: "bg-[var(--tipo-pa-bg)]", text: "text-[var(--tipo-pa)]" },
    amber: { bg: "bg-[var(--deadline-today-bg)]", text: "text-[var(--deadline-today)]" },
    red: { bg: "bg-[var(--deadline-overdue-bg)]", text: "text-[var(--deadline-overdue)]" },
  };
  const t = tones[tone];
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={`text-left rounded-2xl border bg-card p-4 sm:p-5 transition-all shadow-card ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer" : ""
      } ${
        active
          ? "ring-2 ring-offset-2 ring-offset-background ring-accent border-accent"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex h-7 w-7 rounded-lg items-center justify-center ${t.bg}`}
        >
          <Icon className={`h-3.5 w-3.5 ${t.text}`} />
        </span>
        <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {label}
        </p>
      </div>
      <div className={`text-3xl sm:text-4xl font-bold tabular-nums tracking-tight font-display ${t.text}`}>
        {value}
      </div>
      {sub && (
        <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
      )}
    </Component>
  );
}
