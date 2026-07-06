import { useMemo, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  CalendarRange,
  TrendingUp,
  CheckCircle2,
  Inbox,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { ProcessosStats } from "@/hooks/useProcessosStats";
import { useAcervoProcessual } from "@/hooks/useAcervoProcessual";
import type { Processo, FiltroPrazo } from "@/types/processo";
import { statusPrazo, toDateLocal } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  filtro: FiltroPrazo;
  onFiltroChange: (f: FiltroPrazo) => void;
  /**
   * Estado de sincronização do `useProcessos` com o servidor.
   * Enquanto `true`, o array `processos` pode ser apenas o cache local (stale).
   */
  loadingProcessos?: boolean;
  /**
   * Contagens históricas do servidor (uma ÚNICA fonte, compartilhada com
   * Estatisticas via routes/index.tsx) — evita duplicar as mesmas consultas
   * getCountFromServer em cada tela.
   */
  statsServidor: ProcessosStats;
}

/**
 * Verifica se uma data (Timestamp do Firestore OU String ISO) pertence ao mesmo
 * mês/ano de uma data de referência. Usa fuso LOCAL (correto para Manaus/Brasil).
 */
function ehDoMesAtual(value: unknown, ref: Date): boolean {
  const d = toDateLocal(value);
  if (!d) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

const KPI_TONES: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-[oklch(0.6_0.16_230_/_0.12)]", text: "text-[oklch(0.55_0.17_230)]" },
  green: { bg: "bg-[var(--deadline-safe-bg)]", text: "text-[var(--deadline-safe)]" },
  purple: { bg: "bg-[var(--tipo-pa-bg)]", text: "text-[var(--tipo-pa)]" },
  amber: { bg: "bg-[var(--deadline-today-bg)]", text: "text-[var(--deadline-today)]" },
  red: { bg: "bg-[var(--deadline-overdue-bg)]", text: "text-[var(--deadline-overdue)]" },
};

export function Dashboard({ processos, filtro, onFiltroChange, loadingProcessos = false, statsServidor }: Props) {
  // O array `processos` agora vem HÍBRIDO do useProcessos: ATIVOS + Últimos 50
  // FINALIZADOS (para a aba "Finalizados" do Kanban). Separamos aqui.
  const processosAtivos = useMemo(
    () => processos.filter((p) => p.status !== "concluido"),
    [processos],
  );

  // ---------- KPIs de PRAZO (client-side, EXCLUSIVO DU) ----------
  // statusPrazo aceita Timestamp do Firestore ou String ISO (ver lib/prazo).
  // Regra de precedencia: vencido nao entra em "hoje" nem em "semana".
  // Cada card DU considera prazoFatal e pedidoSubsidios.prazoResposta.
  const processosDUAtivos = processosAtivos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "DU",
  );
  const vencidos = processosDUAtivos.filter((p) => {
    return statusPrazo(p.prazoFatal) === "overdue" || statusPrazo(p.pedidoSubsidios?.prazoResposta) === "overdue";
  }).length;
  const hoje = processosDUAtivos.filter((p) => {
    const sFatal = statusPrazo(p.prazoFatal);
    const sResp = statusPrazo(p.pedidoSubsidios?.prazoResposta);
    if (sFatal === "overdue" || sResp === "overdue") return false;
    return sFatal === "today" || sResp === "today";
  }).length;
  const semana = processosDUAtivos.filter((p) => {
    const sFatal = statusPrazo(p.prazoFatal);
    const sResp = statusPrazo(p.pedidoSubsidios?.prazoResposta);
    if (sFatal === "overdue" || sResp === "overdue") return false;
    return sFatal === "today" || sFatal === "soon" || sResp === "today" || sResp === "soon";
  }).length;

  // ---------- Entradas no mês: deriva da prop unificada (Timestamp OU String ISO) ----------
  const mesRef = useMemo(() => new Date(), []);
  const criadosMes = useMemo(
    () =>
      processos.filter((p) => {
        // pode existir tanto `criadoEm` (novo) quanto `dataEntrada` (legado)
        return (
          ehDoMesAtual(p.criadoEm, mesRef) ||
          ehDoMesAtual((p as unknown as { dataEntrada?: unknown }).dataEntrada, mesRef)
        );
      }).length,
    [processos, mesRef],
  );

  const finalizadosMes = useMemo(
    () =>
      processos.reduce((acc, p) => {
        if (p.status !== "concluido") return acc;
        return acc + (ehDoMesAtual(p.atualizadoEm, mesRef) ? 1 : 0);
      }, 0),
    [processos, mesRef],
  );

  const resolutividadeMes = criadosMes > 0 ? Math.round((finalizadosMes / criadosMes) * 100) : 0;

  // ---------- Acervo Processual (total, DU, PA, Ativos, % de conclusão) ----------
  // V9.9 — Fonte única compartilhada com Estatisticas.tsx (ver useAcervoProcessual):
  // antes desta extração, cada tela tinha seu próprio gate de prontidão, e só um
  // dos dois havia sido corrigido para esperar o servidor confirmar os dados de
  // "ativos" antes de liberar os números — o outro seguia exibindo o bug.
  const acervo = useAcervoProcessual(processos, loadingProcessos, statsServidor);

  // Valores de exibição: só existem quando os dados batem de verdade — enquanto
  // não estiverem prontos, a UI mostra o spinner (ver mostrarPlaceholder* abaixo)
  // em vez de arriscar exibir um número parcial/desatualizado.
  const displayCriadosMes = criadosMes;
  const displayFinalizadosMes = finalizadosMes;
  const displayResolutividadeMes = resolutividadeMes;
  const displayTotalConcluidos = acervo.totalConcluidos;
  const displayTotalGeral = acervo.totalGeral;
  const displayTotalDU = acervo.totalDU;
  const displayTotalPA = acervo.totalPA;
  const displayAcervoAtivo = acervo.acervoAtivo;
  const displayVencidos = vencidos;
  const displayHoje = hoje;
  const displaySemana = semana;
  const displayTaxaConclusao = acervo.taxaConclusao;

  // Mostra o spinner enquanto os hooks assíncronos (processos ativos + contagem
  // do servidor) não tiverem os dois confirmado — nunca exibe número parcial.
  const mostrarPlaceholderAtivos = !acervo.ativosProntos;
  const mostrarPlaceholderHistorico = !acervo.historicoProntos;
  const mostrarPlaceholderCombinado = !acervo.prontos;

  const placeholder = (
    <Loader2 className="inline-block h-[0.7em] w-[0.7em] animate-spin opacity-60 align-middle" />
  );

  return (
    <div className="space-y-4">
      {/* === HERO BANNER: Acervo Processual === */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Acervo Processual (esquerda, maior) — JSX espelhado de Indicadores de Gestão
            (Estatisticas.tsx) para garantir paridade visual e numérica entre as duas telas. */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-[oklch(0.22_0.05_258)] to-[oklch(0.32_0.1_245)] text-white p-3.5 sm:p-4 shadow-elegant relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[oklch(0.6_0.16_230)]/30 blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[oklch(0.78_0.18_145)]">
                Acervo Processual
              </p>
              <button
                type="button"
                onClick={() => statsServidor.refresh()}
                disabled={statsServidor.carregando}
                title="Atualizar contagens do servidor"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${statsServidor.carregando ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <div className="text-3xl sm:text-4xl font-bold font-display tabular-nums leading-none">{mostrarPlaceholderCombinado ? placeholder : displayTotalGeral}</div>
                <p className="text-sm sm:text-base text-white/85 mt-1.5">Processos cadastrados</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">DU: {mostrarPlaceholderCombinado ? placeholder : displayTotalDU}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">PA: {mostrarPlaceholderCombinado ? placeholder : displayTotalPA}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">Ativos: {mostrarPlaceholderAtivos ? placeholder : displayAcervoAtivo}</span>
                </div>
              </div>

              <div>
                <div className="flex items-end gap-2 leading-none">
                  <span className="text-2xl sm:text-3xl font-bold text-[oklch(0.78_0.18_145)] mb-0.5">{mostrarPlaceholderCombinado ? placeholder : `${displayTaxaConclusao}%`}</span>
                  <span className="text-lg font-bold font-display tabular-nums text-[oklch(0.78_0.18_145)]">
                    {mostrarPlaceholderCombinado ? placeholder : displayTotalConcluidos}
                  </span>
                </div>
                <p className="text-sm sm:text-base text-white/85 mt-1.5">Finalizados</p>
                <p className="text-xs text-white/60 mt-0.5">
                  {mostrarPlaceholderCombinado ? placeholder : `${displayTaxaConclusao}% do total cadastrado`}
                </p>

                <div className="mt-2 h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[oklch(0.78_0.18_145)]"
                    style={{ width: `${displayTaxaConclusao}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vencidos / Vencem Hoje — versão compacta, ao lado do Acervo Processual */}
        <div className="flex flex-col gap-3">
          <KpiMini
            label="Vencidos"
            value={mostrarPlaceholderAtivos ? placeholder : displayVencidos}
            icon={AlertTriangle}
            tone="red"
            active={filtro === "vencidos"}
            onClick={() => onFiltroChange(filtro === "vencidos" ? "todos" : "vencidos")}
          />
          <KpiMini
            label="Vencem Hoje"
            value={mostrarPlaceholderAtivos ? placeholder : displayHoje}
            icon={Clock}
            tone="amber"
            active={filtro === "hoje"}
            onClick={() => onFiltroChange(filtro === "hoje" ? "todos" : "hoje")}
          />
        </div>
      </div>

      {/* === KPIs do mês === */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Entradas no mês"
          value={mostrarPlaceholderAtivos ? placeholder : displayCriadosMes}
          icon={Inbox}
          tone="blue"
          active={false}
          onClick={() => onFiltroChange("todos")}
        />
        <KpiCard
          label="Finalizações no mês"
          value={mostrarPlaceholderHistorico ? placeholder : displayFinalizadosMes}
          icon={CheckCircle2}
          tone="green"
          active={false}
        />
        <KpiCard
          label="Índice de Resolutividade"
          value={mostrarPlaceholderCombinado ? placeholder : `${displayResolutividadeMes}%`}
          icon={TrendingUp}
          tone="purple"
          active={false}
        />
      </div>

      {/* === KPIs de prazo (clicáveis para filtrar) === */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Próximos 7 dias"
          value={mostrarPlaceholderAtivos ? placeholder : displaySemana}
          sub={mostrarPlaceholderAtivos ? "sincronizando…" : "planejar semana"}
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
  value: ReactNode;
  sub?: string;
  icon: typeof AlertTriangle;
  tone: "blue" | "green" | "purple" | "amber" | "red";
  active: boolean;
  onClick?: () => void;
}) {
  const t = KPI_TONES[tone];
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

/**
 * Versão compacta do KpiCard — usada ao lado do Acervo Processual para
 * "Vencidos" e "Vencem Hoje" em escala reduzida (sem o texto `sub`).
 */
function KpiMini({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  icon: typeof AlertTriangle;
  tone: "blue" | "green" | "purple" | "amber" | "red";
  active: boolean;
  onClick?: () => void;
}) {
  const t = KPI_TONES[tone];
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={`flex-1 text-left rounded-xl border bg-card p-2.5 transition-all shadow-card ${
        onClick ? "hover:-translate-y-0.5 hover:shadow-card-hover cursor-pointer" : ""
      } ${
        active
          ? "ring-2 ring-offset-1 ring-offset-background ring-accent border-accent"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-flex h-5 w-5 rounded-md items-center justify-center ${t.bg}`}>
          <Icon className={`h-2.5 w-2.5 ${t.text}`} />
        </span>
        <p className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground truncate">
          {label}
        </p>
      </div>
      <div className={`text-xl font-bold tabular-nums tracking-tight font-display ${t.text}`}>
        {value}
      </div>
    </Component>
  );
}
