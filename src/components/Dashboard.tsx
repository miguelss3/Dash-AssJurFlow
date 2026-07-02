import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Clock,
  CalendarRange,
  TrendingUp,
  Trophy,
  CheckCircle2,
  Inbox,
  BarChart2,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProcessosStats } from "@/hooks/useProcessosStats";
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
}

interface ServerStats {
  totalConcluidos: number;
  finalizadosMes: number;
  carregando: boolean;
}

const STATS_INICIAIS: ServerStats = {
  totalConcluidos: 0,
  finalizadosMes: 0,
  carregando: true,
};

/**
 * Verifica se uma data (Timestamp do Firestore OU String ISO) pertence ao mesmo
 * mês/ano de uma data de referência. Usa fuso LOCAL (correto para Manaus/Brasil).
 */
function ehDoMesAtual(value: unknown, ref: Date): boolean {
  const d = toDateLocal(value);
  if (!d) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function Dashboard({ processos, filtro, onFiltroChange, loadingProcessos = false }: Props) {
  const { user } = useAuth();

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

  // ---------- Contagem por setor a partir dos ATIVOS ----------
  const ativosDU = processosAtivos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "DU",
  ).length;
  const ativosPA = processosAtivos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "PA",
  ).length;
  const acervoAtivo = processosAtivos.length;

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

  const mesNome = useMemo(
    () => mesRef.toLocaleString("pt-BR", { month: "long", year: "numeric" }),
    [mesRef],
  );

  // ---------- Estatísticas SERVIDOR (finalizados = status:concluido) ----------
  // V9.8 — Usa o hook compartilhado `useProcessosStats` (fonte ÚNICA de verdade)
  // para que Dashboard e Indicadores de Gestão exibam EXATAMENTE os mesmos números.
  const statsServidor = useProcessosStats();
  const [stats, setStats] = useState<ServerStats>(STATS_INICIAIS);
  // Tarefa 3: Fallback de resiliência. Se o servidor demorar mais de 3s para responder
  // às contagens, liberamos a UI mesmo assim — melhor mostrar dados parciais (ainda sem
  // o totalConcluidos histórico) do que travar o usuário em "…" indefinidamente.
  const [statsTimeout, setStatsTimeout] = useState(false);

  useEffect(() => {
    if (!user) return;
    setStatsTimeout(false);
    const id = setTimeout(() => {
      setStatsTimeout(true);
    }, 3000);
    return () => clearTimeout(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelado = false;

    const carregar = () => {
      // V9.8 — Total de concluídos vem do hook compartilhado (não duplicar query).
      // Finalizações do mês permanecem locais (derivadas dos últimos 50 do snapshot).
      const finalizadosMes = processos.reduce((acc, p) => {
        if (p.status !== "concluido") return acc;
        return acc + (ehDoMesAtual(p.atualizadoEm, mesRef) ? 1 : 0);
      }, 0);

      if (cancelado) return;
      setStats({
        totalConcluidos: statsServidor.totalConcluidos,
        finalizadosMes,
        carregando: statsServidor.carregando,
      });
    };

    carregar();

    return () => {
      cancelado = true;
    };
  }, [user, mesRef, processos, statsServidor.totalConcluidos, statsServidor.carregando]);

  // ---------- Derivados ----------
  // V9.8 — Fonte ÚNICA de verdade (hook useProcessosStats):
  //  - Concluídos: counts REAIS do servidor por setor (DU/PA).
  //  - Ativos: array local (snapshot em tempo real, completo).
  //  - Totais por setor: ativos_setor + concluidos_setor(servidor).
  // Assim os badges do banner do Dashboard batem EXATAMENTE com os Indicadores.
  const { finalizadosMes } = stats;

  const totalConcluidosLocal = statsServidor.totalConcluidos;
  const totalDU = ativosDU + statsServidor.totalConcluidosDU;
  const totalPA = ativosPA + statsServidor.totalConcluidosPA;
  const totalGeralLocal = totalDU + totalPA;

  const taxaConclusao = totalGeralLocal > 0 ? Math.round((totalConcluidosLocal / totalGeralLocal) * 100) : 0;
  const resolutividadeMes = criadosMes > 0 ? Math.round((finalizadosMes / criadosMes) * 100) : 0;

  // V2.13 — Optimistic UI: gates de carregamento mantidos apenas para placeholders/cache.
  const dadosAtivosProntos = !loadingProcessos;
  const dadosHistoricosProntos = !stats.carregando || statsTimeout;
  const dadosProntos = dadosAtivosProntos && dadosHistoricosProntos;

  // Aliases retrocompatíveis para o restante do componente.
  const totalConcluidos = totalConcluidosLocal;
  const totalGeral = totalGeralLocal;

  // Valores de exibição: só existem quando os dados batem de verdade — enquanto
  // não estiverem prontos, a UI mostra o spinner (ver mostrarPlaceholder* abaixo)
  // em vez de arriscar exibir um número parcial/desatualizado.
  const displayCriadosMes = criadosMes;
  const displayFinalizadosMes = finalizadosMes;
  const displayResolutividadeMes = resolutividadeMes;
  const displayTotalConcluidos = totalConcluidosLocal;
  const displayTotalGeral = totalGeralLocal;
  const displayAtivosDU = ativosDU;
  const displayAtivosPA = ativosPA;
  const displayTotalDU = totalDU;
  const displayTotalPA = totalPA;
  const displayAcervoAtivo = acervoAtivo;
  const displayVencidos = vencidos;
  const displayHoje = hoje;
  const displaySemana = semana;
  const displayTaxaConclusao = taxaConclusao;

  // Mostra o spinner enquanto os hooks assíncronos (processos ativos + contagem
  // do servidor) não tiverem os dois confirmado — nunca exibe número parcial.
  const mostrarPlaceholderAtivos = !dadosAtivosProntos;
  const mostrarPlaceholderHistorico = !dadosHistoricosProntos;
  const mostrarPlaceholderCombinado = !dadosProntos;

  const placeholder = (
    <Loader2 className="inline-block h-[0.7em] w-[0.7em] animate-spin opacity-60 align-middle" />
  );

  return (
    <div className="space-y-4">
      {/* === HERO BANNER: Acervo Processual === */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Índice Mensal (esquerdo) */}
        <div className="rounded-2xl bg-card border border-border p-3 shadow-card flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 rounded-md bg-[oklch(0.6_0.16_230_/_0.12)] items-center justify-center shrink-0">
              <BarChart2 className="h-3 w-3 text-[oklch(0.55_0.17_230)]" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider font-bold text-foreground leading-tight">
                Índice Mensal
              </p>
              <p className="text-[9px] text-muted-foreground capitalize leading-tight">
                {mesNome}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">Cadastrados</span>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {mostrarPlaceholderAtivos ? placeholder : displayCriadosMes}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-medium">Finalizados</span>
              <span className="text-xs font-bold tabular-nums text-[var(--deadline-safe)]">
                {mostrarPlaceholderHistorico ? placeholder : displayFinalizadosMes}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground font-medium">Resolutividade</span>
              <span className="text-[11px] font-bold tabular-nums text-foreground">
                {mostrarPlaceholderCombinado ? placeholder : `${displayResolutividadeMes}%`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.6_0.16_230)] to-[oklch(0.78_0.18_145)] transition-all"
                style={{ width: `${displayResolutividadeMes}%` }}
              />
            </div>
          </div>
        </div>

        {/* Acervo Processual — JSX espelhado de Indicadores de Gestão (Estatisticas.tsx)
            para garantir paridade visual e numérica entre as duas telas. */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-[oklch(0.22_0.05_258)] to-[oklch(0.32_0.1_245)] text-white p-3.5 sm:p-4 shadow-elegant relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[oklch(0.6_0.16_230)]/30 blur-3xl pointer-events-none" />

          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[oklch(0.78_0.18_145)] mb-2.5">
              Acervo Processual
            </p>

            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <div className="text-3xl sm:text-4xl font-bold font-display tabular-nums leading-none">{mostrarPlaceholderCombinado ? placeholder : displayTotalGeral}</div>
                <p className="text-sm sm:text-base text-white/85 mt-1.5">Processos cadastrados</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">DU: {displayTotalDU}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">PA: {displayTotalPA}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">Ativos: {displayAcervoAtivo}</span>
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
                <p className="text-xs text-white/60 mt-0.5">{displayTaxaConclusao}% do total cadastrado</p>

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
      </div>

      {/* === KPIs do mês === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
        <KpiCard
          label="Acervo Total"
          value={mostrarPlaceholderHistorico ? placeholder : displayTotalGeral}
          icon={Trophy}
          tone="amber"
          active={false}
        />
      </div>

      {/* === KPIs de prazo (clicáveis para filtrar) === */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <KpiCard
          label="Vencidos"
          value={mostrarPlaceholderAtivos ? placeholder : displayVencidos}
          sub={mostrarPlaceholderAtivos
            ? "sincronizando…"
            : displayVencidos > 0 ? "ação imediata" : "tudo em dia"}
          icon={AlertTriangle}
          tone="red"
          active={filtro === "vencidos"}
          onClick={() => onFiltroChange(filtro === "vencidos" ? "todos" : "vencidos")}
        />
        <KpiCard
          label="Vencem Hoje"
          value={mostrarPlaceholderAtivos ? placeholder : displayHoje}
          sub={mostrarPlaceholderAtivos
            ? "sincronizando…"
            : displayHoje > 0 ? "priorizar" : "sem prazos"}
          icon={Clock}
          tone="amber"
          active={filtro === "hoje"}
          onClick={() => onFiltroChange(filtro === "hoje" ? "todos" : "hoje")}
        />
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
