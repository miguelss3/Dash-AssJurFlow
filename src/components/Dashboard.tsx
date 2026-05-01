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
import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/hooks/useAuth";
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

// V2.14 — Stale-While-Revalidate: cache local das métricas para evitar
// "flash de zeros" e números dessincronizados no carregamento inicial.
const CACHE_KEY = "assjur_dashboard_metrics";

interface CachedMetrics {
  criadosMes: number;
  finalizadosMes: number;
  resolutividadeMes: number;
  totalConcluidos: number;
  totalGeral: number;
  ativosDU: number;
  ativosPA: number;
  acervoAtivo: number;
  vencidos: number;
  hoje: number;
  semana: number;
  taxaConclusao: number;
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

export function Dashboard({ processos, filtro, onFiltroChange, loadingProcessos = false }: Props) {
  const { user } = useAuth();
  const ehAdmin = isAdmin(user);
  const setorUsuario = String(user?.setor || "").trim().toUpperCase();
  const escopoSetor =
    !ehAdmin && (setorUsuario === "DU" || setorUsuario === "PA") ? setorUsuario : null;

  // V2.14 — Cache SWR: hidrata métricas da última sessão instantaneamente.
  const [cachedMetrics, setCachedMetrics] = useState<CachedMetrics | null>(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      return saved ? (JSON.parse(saved) as CachedMetrics) : null;
    } catch {
      return null;
    }
  });

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
  // Como o useProcessos agora também carrega os ÚLTIMOS 50 finalizados no cliente,
  // poderíamos contar localmente — mas o limite de 50 é propositadamente baixo,
  // então continuamos batendo no servidor para o total HISTÓRICO real.
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

    const carregar = async () => {
      const processosRef = collection(db, "processos");

      // Escopo por setor (admin → DU+PA; usuário comum → seu setor)
      const escopoBase: QueryConstraint[] = escopoSetor
        ? [where("setor", "==", escopoSetor)]
        : ehAdmin
          ? [where("setor", "in", ["DU", "PA"])]
          : [];

      // ---------- Contagem TOTAL de finalizados (status == concluido) ----------
      let totalConcluidos = 0;
      try {
        const qConcluidos = query(
          processosRef,
          ...escopoBase,
          where("status", "==", "concluido"),
        );
        const snap = await getCountFromServer(qConcluidos);
        totalConcluidos = snap.data().count;
      } catch (err) {
        console.error("Dashboard: falha ao contar finalizados (status==concluido):", err);
      }

      // ---------- Finalizações do mês (derivada do cache local de finalizados) ----------
      // O useProcessos já baixou os últimos 50 finalizados ordenados por
      // `atualizadoEm desc`, que cobre confortavelmente o mês corrente.
      const finalizadosMes = processos.reduce((acc, p) => {
        if (p.status !== "concluido") return acc;
        return acc + (ehDoMesAtual(p.atualizadoEm, mesRef) ? 1 : 0);
      }, 0);

      if (cancelado) return;
      setStats({ totalConcluidos, finalizadosMes, carregando: false });
    };

    carregar();

    return () => {
      cancelado = true;
    };
  }, [user, ehAdmin, escopoSetor, mesRef, processos]);

  // ---------- Derivados ----------
  const { totalConcluidos, finalizadosMes } = stats;

  // V2.13 — Optimistic UI: separamos os gates de carregamento por origem do dado.
  //   - `dadosAtivosProntos`: depende apenas do snapshot local de processos ATIVOS
  //     (Kanban + KPIs urgentes). Libera assim que o cache do Firestore responder.
  //   - `dadosHistoricosProntos`: depende do `getCountFromServer` (Acervo Histórico).
  //     Pode demorar mais alguns segundos sem bloquear a UI principal.
  const dadosAtivosProntos = !loadingProcessos;
  const dadosHistoricosProntos = !stats.carregando || statsTimeout;
  const dadosProntos = dadosAtivosProntos && dadosHistoricosProntos;

  // Tarefa 3: total geral = ativos (props) + finalizados (server).
  const totalGeral = acervoAtivo + totalConcluidos;
  const taxaConclusao =
    totalGeral > 0 ? Math.round((totalConcluidos / totalGeral) * 100) : 0;
  const resolutividadeMes =
    criadosMes > 0 ? Math.round((finalizadosMes / criadosMes) * 100) : 0;

  // V2.14 — Persiste métricas no localStorage assim que tudo confirma do servidor.
  useEffect(() => {
    if (!dadosProntos) return;
    const currentMetrics: CachedMetrics = {
      criadosMes,
      finalizadosMes,
      resolutividadeMes,
      totalConcluidos,
      totalGeral,
      ativosDU,
      ativosPA,
      acervoAtivo,
      vencidos,
      hoje,
      semana,
      taxaConclusao,
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(currentMetrics));
    } catch {
      // localStorage cheio ou indisponível — segue sem cache.
    }
    setCachedMetrics(currentMetrics);
  }, [
    dadosProntos,
    criadosMes,
    finalizadosMes,
    resolutividadeMes,
    totalConcluidos,
    totalGeral,
    ativosDU,
    ativosPA,
    acervoAtivo,
    vencidos,
    hoje,
    semana,
    taxaConclusao,
  ]);

  // V2.14 — Valores de exibição: dados frescos quando prontos, senão cache.
  const displayCriadosMes = dadosAtivosProntos ? criadosMes : (cachedMetrics?.criadosMes ?? 0);
  const displayFinalizadosMes = dadosHistoricosProntos ? finalizadosMes : (cachedMetrics?.finalizadosMes ?? 0);
  const displayResolutividadeMes = dadosProntos ? resolutividadeMes : (cachedMetrics?.resolutividadeMes ?? 0);
  const displayTotalConcluidos = dadosHistoricosProntos ? totalConcluidos : (cachedMetrics?.totalConcluidos ?? 0);
  const displayTotalGeral = dadosHistoricosProntos ? totalGeral : (cachedMetrics?.totalGeral ?? 0);
  const displayAtivosDU = dadosAtivosProntos ? ativosDU : (cachedMetrics?.ativosDU ?? 0);
  const displayAtivosPA = dadosAtivosProntos ? ativosPA : (cachedMetrics?.ativosPA ?? 0);
  const displayAcervoAtivo = dadosAtivosProntos ? acervoAtivo : (cachedMetrics?.acervoAtivo ?? 0);
  const displayVencidos = dadosAtivosProntos ? vencidos : (cachedMetrics?.vencidos ?? 0);
  const displayHoje = dadosAtivosProntos ? hoje : (cachedMetrics?.hoje ?? 0);
  const displaySemana = dadosAtivosProntos ? semana : (cachedMetrics?.semana ?? 0);
  const displayTaxaConclusao = dadosProntos ? taxaConclusao : (cachedMetrics?.taxaConclusao ?? 0);

  // V2.14 — Atualizando: cache disponível mas servidor ainda confirmando.
  const isUpdating = !dadosProntos && cachedMetrics !== null;
  // Mostra placeholder/spinner SÓ na primeira sessão do usuário (sem cache).
  const mostrarPlaceholderAtivos = !dadosAtivosProntos && !cachedMetrics;
  const mostrarPlaceholderHistorico = !dadosHistoricosProntos && !cachedMetrics;
  const mostrarPlaceholderCombinado = !dadosProntos && !cachedMetrics;

  /** Placeholder visual usado apenas na PRIMEIRA carga (sem cache). */
  const placeholder = (
    <Loader2 className="inline-block h-[0.7em] w-[0.7em] animate-spin opacity-60 align-middle" />
  );

  /** Badge sutil "Atualizando…" exibido nos cabeçalhos enquanto o servidor confirma. */
  const updatingBadge = isUpdating ? (
    <span className="inline-flex items-center gap-1 ml-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      <Loader2 className="h-2.5 w-2.5 animate-spin" />
      Atualizando…
    </span>
  ) : null;

  return (
    <div className="space-y-4">
      {/* === HERO BANNER: Acervo Processual === */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Índice Mensal (esquerdo) */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-card flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 rounded-lg bg-[oklch(0.6_0.16_230_/_0.12)] items-center justify-center shrink-0">
              <BarChart2 className="h-4 w-4 text-[oklch(0.55_0.17_230)]" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-foreground leading-tight">
                Índice Mensal{updatingBadge}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                {mesNome}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Cadastrados</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {mostrarPlaceholderAtivos ? placeholder : displayCriadosMes}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Finalizados</span>
              <span className="text-sm font-bold tabular-nums text-[var(--deadline-safe)]">
                {mostrarPlaceholderHistorico ? placeholder : displayFinalizadosMes}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-medium">Resolutividade</span>
              <span className="text-xs font-bold tabular-nums text-foreground">
                {mostrarPlaceholderCombinado ? placeholder : `${displayResolutividadeMes}%`}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.6_0.16_230)] to-[oklch(0.78_0.18_145)] transition-all"
                style={{ width: `${displayResolutividadeMes}%` }}
              />
            </div>
          </div>
        </div>

        {/* Acervo Processual (direito — destaque) */}
        <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-[oklch(0.22_0.05_258)] to-[oklch(0.32_0.1_245)] text-white p-6 shadow-elegant relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[oklch(0.6_0.16_230)]/30 blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[oklch(0.78_0.18_145)] flex items-center gap-1.5 mb-5">
              <Inbox className="h-3 w-3" />
              Acervo Processual{updatingBadge}
            </p>

            <div className="grid grid-cols-2 gap-6">
              {/* Cadastrados (Histórico Total) */}
              <div>
                <div className="text-5xl font-bold font-display tabular-nums leading-none">
                  {mostrarPlaceholderHistorico ? placeholder : displayTotalGeral}
                </div>
                <p className="text-sm text-white/70 mt-2">Processos cadastrados</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/80">
                    DU: {mostrarPlaceholderAtivos ? "…" : displayAtivosDU}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/80">
                    PA: {mostrarPlaceholderAtivos ? "…" : displayAtivosPA}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/80">
                    Ativos: {mostrarPlaceholderAtivos ? "…" : displayAcervoAtivo}
                  </span>
                </div>
              </div>

              {/* Finalizados (Histórico Total) */}
              <div>
                <div className="flex items-end gap-2 leading-none">
                  <div className="text-5xl font-bold font-display tabular-nums text-[oklch(0.78_0.18_145)]">
                    {mostrarPlaceholderCombinado ? placeholder : `${displayTaxaConclusao}%`}
                  </div>
                  <div className="mb-1 text-base font-bold text-[oklch(0.78_0.18_145)] opacity-80 whitespace-nowrap">
                    {mostrarPlaceholderHistorico ? "…" : `- ${displayTotalConcluidos} Finalizados`}
                  </div>
                </div>
                <p className="text-sm text-white/70 mt-2">Índice de Resolução</p>
                <p className="text-xs text-white/50 mt-0.5">
                  {mostrarPlaceholderCombinado
                    ? "sincronizando com servidor…"
                    : "do total do acervo cadastrado"}
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[oklch(0.78_0.18_145)] transition-all"
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
