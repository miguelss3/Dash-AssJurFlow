import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  CalendarRange,
  TrendingUp,
  Trophy,
  CheckCircle2,
  Inbox,
  BarChart2,
} from "lucide-react";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import type { Processo, FiltroPrazo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  filtro: FiltroPrazo;
  onFiltroChange: (f: FiltroPrazo) => void;
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
 * Converte com segurança qualquer formato de data vindo do Firestore.
 * Aceita Timestamp nativo (com .toDate()), objetos { seconds, nanoseconds },
 * Date instância ou String ISO. Retorna null se não conseguir converter.
 */
function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  // Firestore Timestamp (cliente SDK)
  if (typeof value === "object" && value !== null) {
    const maybeTs = value as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === "function") {
      try {
        const d = maybeTs.toDate();
        return Number.isNaN(d.getTime()) ? null : d;
      } catch {
        /* cai pro próximo fallback */
      }
    }
    if (typeof maybeTs.seconds === "number") {
      return new Date(maybeTs.seconds * 1000);
    }
  }

  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function ehDoMesAtual(value: unknown, ref: Date): boolean {
  const d = toDateSafe(value);
  if (!d) return false;
  return d.getUTCFullYear() === ref.getUTCFullYear() && d.getUTCMonth() === ref.getUTCMonth();
}

export function Dashboard({ processos, filtro, onFiltroChange }: Props) {
  const { user } = useAuth();
  const ehAdmin = isAdmin(user);
  const setorUsuario = String(user?.setor || "").trim().toUpperCase();
  const escopoSetor =
    !ehAdmin && (setorUsuario === "DU" || setorUsuario === "PA") ? setorUsuario : null;

  // ---------- KPIs de PRAZO (client-side, sobre os ATIVOS recebidos via prop) ----------
  const ativosDUFatal = processos.filter((p) => {
    const setor = (p.setor || p.tipo || "").toString().toUpperCase();
    return setor === "DU" && Boolean(p.prazoFatal);
  });
  const vencidos = ativosDUFatal.filter((p) => statusPrazo(p.prazoFatal) === "overdue").length;
  const hoje = ativosDUFatal.filter((p) => statusPrazo(p.prazoFatal) === "today").length;
  const semana = ativosDUFatal.filter((p) => {
    const s = statusPrazo(p.prazoFatal);
    return s === "today" || s === "soon";
  }).length;

  // ---------- Contagem por setor a partir dos ATIVOS (props) ----------
  const ativosDU = processos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "DU",
  ).length;
  const ativosPA = processos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "PA",
  ).length;
  const acervoAtivo = processos.length;

  // ---------- Entradas no mês: deriva da prop, lidando com Timestamp OU String ISO ----------
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

  // ---------- Estatísticas SERVIDOR (concluídos = ativo:false) ----------
  const [stats, setStats] = useState<ServerStats>(STATS_INICIAIS);

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

      // ---------- Tarefa 1: contagem TOTAL de concluídos (ativo == false) ----------
      let totalConcluidos = 0;
      try {
        const qConcluidos = query(
          processosRef,
          ...escopoBase,
          where("ativo", "==", false),
        );
        const snap = await getCountFromServer(qConcluidos);
        totalConcluidos = snap.data().count;
      } catch (err) {
        console.error("Dashboard: falha ao contar concluídos (ativo==false):", err);
      }

      // ---------- Tarefa 2: conclusões do mês — query híbrida ----------
      let finalizadosMes = 0;
      try {
        const qFinalizadosRecentes = query(
          processosRef,
          ...escopoBase,
          where("ativo", "==", false),
          orderBy("atualizadoEm", "desc"),
          limit(200),
        );
        const docsSnap = await getDocs(qFinalizadosRecentes);
        finalizadosMes = docsSnap.docs.reduce((acc, doc) => {
          const data = doc.data() as { atualizadoEm?: unknown };
          return acc + (ehDoMesAtual(data.atualizadoEm, mesRef) ? 1 : 0);
        }, 0);
      } catch (err) {
        console.warn(
          "Dashboard: a query de finalizadosMes falhou — provavelmente exige um " +
            "ÍNDICE COMPOSTO no Firestore (campos: setor + ativo + atualizadoEm). " +
            "Abra o link gerado pelo Firebase no console do navegador para criar o índice automaticamente.",
          err,
        );
      }

      if (cancelado) return;
      setStats({ totalConcluidos, finalizadosMes, carregando: false });
    };

    carregar();

    return () => {
      cancelado = true;
    };
  }, [user, ehAdmin, escopoSetor, mesRef]);

  // ---------- Derivados ----------
  const { totalConcluidos, finalizadosMes } = stats;

  // Tarefa 3: total geral = ativos (props) + concluídos (server)
  const totalGeral = acervoAtivo + totalConcluidos;
  const taxaConclusao = totalGeral > 0 ? Math.round((totalConcluidos / totalGeral) * 100) : 0;
  const resolutividadeMes =
    criadosMes > 0 ? Math.round((finalizadosMes / criadosMes) * 100) : 0;

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
                Índice Mensal
              </p>
              <p className="text-[10px] text-muted-foreground capitalize leading-tight">
                {mesNome}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Cadastrados</span>
              <span className="text-sm font-bold tabular-nums text-foreground">{criadosMes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Finalizados</span>
              <span className="text-sm font-bold tabular-nums text-[var(--deadline-safe)]">{finalizadosMes}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-medium">Resolutividade</span>
              <span className="text-xs font-bold tabular-nums text-foreground">{resolutividadeMes}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.6_0.16_230)] to-[oklch(0.78_0.18_145)] transition-all"
                style={{ width: `${resolutividadeMes}%` }}
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
              Acervo Processual
            </p>

            <div className="grid grid-cols-2 gap-6">
              {/* Cadastrados (Histórico Total) */}
              <div>
                <div className="text-5xl font-bold font-display tabular-nums leading-none">
                  {totalGeral}
                </div>
                <p className="text-sm text-white/70 mt-2">Processos cadastrados</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/80">
                    DU: {ativosDU}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/80">
                    PA: {ativosPA}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/80">
                    Ativos: {acervoAtivo}
                  </span>
                </div>
              </div>

              {/* Finalizados (Histórico Total) */}
              <div>
                <div className="flex items-end gap-2 leading-none">
                  <div className="text-5xl font-bold font-display tabular-nums text-[oklch(0.78_0.18_145)]">
                    {totalConcluidos}
                  </div>
                  <div className="mb-1 text-base font-bold text-[oklch(0.78_0.18_145)] opacity-80">
                    {taxaConclusao}%
                  </div>
                </div>
                <p className="text-sm text-white/70 mt-2">Finalizados</p>
                <p className="text-xs text-white/50 mt-0.5">{taxaConclusao}% do total cadastrado</p>
                <div className="mt-3 h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[oklch(0.78_0.18_145)] transition-all"
                    style={{ width: `${taxaConclusao}%` }}
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
          value={criadosMes}
          icon={Inbox}
          tone="blue"
          active={false}
          onClick={() => onFiltroChange("todos")}
        />
        <KpiCard
          label="Conclusões no mês"
          value={finalizadosMes}
          icon={CheckCircle2}
          tone="green"
          active={false}
        />
        <KpiCard
          label="Índice de Resolutividade"
          value={`${resolutividadeMes}%`}
          icon={TrendingUp}
          tone="purple"
          active={false}
        />
        <KpiCard
          label="Acervo Total"
          value={totalGeral}
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
