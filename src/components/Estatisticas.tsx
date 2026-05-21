import { useEffect, useMemo, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, Award, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Processo } from "@/types/processo";
import { COLUNAS } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";
import { useProcessosStats } from "@/hooks/useProcessosStats";
import { Button } from "@/components/ui/button";
import {
  exportIndicadoresGeraisPdf,
  exportIndicadoresGeraisPdfFromElement,
  exportSindicanciasPdf,
  exportIPMPdf,
} from "@/lib/indicadoresPdf";

interface Props {
  processos: Processo[];
}

const STATUS_COLORS: Record<string, string> = {
  novo: "oklch(0.6 0.16 230)",
  andamento: "oklch(0.62 0.22 305)",
  audiencia: "oklch(0.7 0.17 50)",
  recurso: "oklch(0.58 0.22 25)",
  concluido: "oklch(0.6 0.15 155)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(1 0 0)",
  border: "1px solid oklch(0.92 0.005 240)",
  borderRadius: 12,
  fontSize: 12,
  color: "oklch(0.22 0.03 255)",
  boxShadow: "0 8px 32px oklch(0.22 0.05 258 / 0.15)",
} as const;

const AXIS_COLOR = "oklch(0.5 0.02 255)";
const GRID_COLOR = "oklch(0.92 0.005 240)";
const ACCENT = "oklch(0.6 0.16 230)";
const ACCENT_LIME = "oklch(0.78 0.18 145)";

function assuntoIndicePrincipal(value?: string) {
  const texto = String(value || "Outros").trim();
  if (!texto) return "Outros";

  const [principal] = texto.split(/\s[-–—]\s/);
  return (principal || texto).trim() || "Outros";
}

function normalizarChaveAssunto(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function Estatisticas({ processos }: Props) {
  const indicadoresPrintRef = useRef<HTMLDivElement | null>(null);
  // V9.8 — Fonte ÚNICA de verdade: counts históricos vindos do servidor,
  // separados por setor. Garante convergência com o Dashboard.
  const statsServidor = useProcessosStats();

  const handleExportEstatisticas = async () => {
    if (!indicadoresPrintRef.current) {
      toast.error("Não foi possível localizar a área de impressão dos indicadores.");
      return;
    }

    try {
      await exportIndicadoresGeraisPdfFromElement(indicadoresPrintRef.current);
      toast.success("PDF de estatísticas gerais gerado e baixado com sucesso.");
    } catch (error) {
      console.error("Falha ao gerar PDF visual dos indicadores:", error);
      exportIndicadoresGeraisPdf(processos);
      toast.warning("Falha no layout visual. PDF simplificado foi gerado automaticamente.");
    }
  };

  const handleExportSindicancias = () => {
    exportSindicanciasPdf(processos);
    toast.success("PDF de sindicâncias gerado.");
  };

  const handleExportIPM = () => {
    exportIPMPdf(processos);
    toast.success("PDF de IPM gerado.");
  };

  const dadosStatus = useMemo(
    () =>
      COLUNAS.map((c) => ({
        name: c.titulo,
        value: processos.filter((p) => p.status === c.id).length,
        fill: STATUS_COLORS[c.id],
      })),
    [processos],
  );

  const dadosPrazos = useMemo(() => {
    const ativos = processos.filter((p) => p.status !== "concluido");
    return [
      {
        name: "Vencidos",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "overdue").length,
        fill: "oklch(0.58 0.22 25)",
      },
      {
        name: "Hoje",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "today").length,
        fill: "oklch(0.7 0.17 50)",
      },
      {
        name: "Em breve",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "soon").length,
        fill: "oklch(0.78 0.16 90)",
      },
      {
        name: "Em dia",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "safe").length,
        fill: "oklch(0.6 0.15 155)",
      },
    ];
  }, [processos]);

  const dadosResponsavel = useMemo(() => {
    const map = new Map<string, { ativos: number; concluidos: number }>();
    processos.forEach((p) => {
      const r = p.responsavel || "Sem responsável";
      const cur = map.get(r) ?? { ativos: 0, concluidos: 0 };
      if (p.status === "concluido") cur.concluidos += 1;
      else cur.ativos += 1;
      map.set(r, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ativos: v.ativos, concluidos: v.concluidos }))
      .sort((a, b) => b.ativos + b.concluidos - (a.ativos + a.concluidos))
      .slice(0, 6);
  }, [processos]);

  const dadosTipoAcao = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number }>();
    processos.forEach((p) => {
      const principal = assuntoIndicePrincipal(p.tipoAcao);
      const chave = normalizarChaveAssunto(principal);
      const atual = map.get(chave);
      if (!atual) {
        map.set(chave, { nome: principal, valor: 1 });
        return;
      }
      map.set(chave, { ...atual, valor: atual.valor + 1 });
    });
    return Array.from(map.values())
      .map((item) => ({ name: item.nome, value: item.valor }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [processos]);

  const dadosCadastros = useMemo(() => {
    const now = new Date();
    const meses = Array.from({ length: 6 }).map((_, index) => {
      const ref = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
        name: ref.toLocaleDateString("pt-BR", { month: "short" }),
      };
    });

    const map = new Map<string, number>();
    meses.forEach((m) => map.set(m.key, 0));

    processos.forEach((p) => {
      const dataBase = p.criadoEm || p.dataEntrada || p.entrada;
      if (!dataBase) return;
      const d = new Date(dataBase);
      if (Number.isNaN(d.getTime())) return;
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(chave)) return;
      map.set(chave, (map.get(chave) || 0) + 1);
    });

    return meses.map((m) => ({
      name: m.name,
      cadastros: map.get(m.key) || 0,
    }));
  }, [processos]);

  // V9.8 — Totais alinhados com o Dashboard:
  //   total_setor = ativos_setor (snapshot local) + concluídos_setor (servidor)
  // O array local `processos` está limitado a "ativos + últimos 50 concluídos",
  // então contar diretamente nele subestima quando o histórico > 50.
  const setorDe = (p: Processo) => (p.setor || p.tipo || "").toString().toUpperCase();
  const ativosDU = processos.filter((p) => p.status !== "concluido" && setorDe(p) === "DU").length;
  const ativosPA = processos.filter((p) => p.status !== "concluido" && setorDe(p) === "PA").length;
  const totalDU = ativosDU + statsServidor.totalConcluidosDU;
  const totalPA = ativosPA + statsServidor.totalConcluidosPA;
  const total = totalDU + totalPA;
  const concluidos = statsServidor.totalConcluidos;
  const ativos = ativosDU + ativosPA;
  const vencidos = processos.filter(
    (p) => p.status !== "concluido" && statusPrazo(p.prazo) === "overdue",
  ).length;
  const hoje = processos.filter(
    (p) => p.status !== "concluido" && statusPrazo(p.prazo) === "today",
  ).length;
  const proximos7 = processos.filter((p) => {
    if (p.status === "concluido") return false;
    const s = statusPrazo(p.prazo);
    return s === "today" || s === "soon";
  }).length;

  const now = new Date();
  const mesNome = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const noMesAtual = (data?: string) => {
    if (!data) return false;
    const d = new Date(data);
    if (Number.isNaN(d.getTime())) return false;
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  };

  const cadastradosMes = processos.filter((p) => noMesAtual(p.criadoEm || p.dataEntrada || p.entrada)).length;
  const finalizadosMes = processos.filter(
    (p) => p.status === "concluido" && noMesAtual(p.atualizadoEm || p.criadoEm),
  ).length;
  const resolutividadeMes = cadastradosMes > 0 ? Math.round((finalizadosMes / cadastradosMes) * 100) : 0;

  const taxaSucesso = total ? Math.round((concluidos / total) * 100) : 0;
  const topResp = dadosResponsavel[0];

  // AUDITORIA PROFUNDA DE IDs
  useEffect(() => {
    console.group("Auditoria de Processos - Estatísticas");
    console.log("Total recebido:", processos.length);
    console.log("IDs dos processos contados:", processos.map(p => p.numero));
    console.groupEnd();
  }, [processos]);

  return (
    <div className="space-y-5 indicadores-print-root" ref={indicadoresPrintRef}>
      <div data-print-ignore="true" className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Relatórios em PDF
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Exporte os indicadores gerais, sindicâncias e IPM em documentos prontos para
              impressão.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleExportEstatisticas}>
              <FileText className="mr-2 h-4 w-4" />
              Estatísticas
            </Button>
            <Button type="button" variant="outline" onClick={handleExportSindicancias}>
              <FileText className="mr-2 h-4 w-4" />
              Sindicâncias
            </Button>
            <Button type="button" variant="outline" onClick={handleExportIPM}>
              <FileText className="mr-2 h-4 w-4" />
              IPM
            </Button>
          </div>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiHero
          icon={CheckCircle2}
          label="Taxa de conclusão"
          value={`${taxaSucesso}%`}
          sub={`${concluidos} de ${total} processos (histórico total)`}
          tone="success"
        />
        <KpiHero
          icon={Clock}
          label="Processos ativos"
          value={ativos}
          sub="Em acompanhamento"
          tone="primary"
          accent
        />
        <KpiHero
          icon={AlertTriangle}
          label="Atrasados"
          value={vencidos}
          sub={vencidos > 0 ? "Necessitam atenção" : "Tudo em dia"}
          tone="danger"
        />
        <KpiHero
          icon={Award}
          label="Top advogado"
          value={topResp ? topResp.name.split(" ").slice(0, 2).join(" ") : "—"}
          sub={topResp ? `${topResp.ativos + topResp.concluidos} processos` : "Sem dados"}
          tone="info"
          isText
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 rounded-2xl items-center justify-center bg-[oklch(0.6_0.16_230_/_0.12)]">
              <TrendingUp className="h-5 w-5 text-[oklch(0.55_0.17_230)]" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">Índice Mensal</p>
              <p className="text-sm text-muted-foreground capitalize">{mesNome}</p>
            </div>
          </div>

          <div className="mt-6 space-y-2.5 text-base">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cadastrados</span>
              <span className="font-bold tabular-nums">{cadastradosMes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Finalizados</span>
              <span className="font-bold tabular-nums text-[var(--deadline-safe)]">{finalizadosMes}</span>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-muted-foreground">Resolutividade</span>
              <span className="font-bold tabular-nums">{resolutividadeMes}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[oklch(0.6_0.16_230)] to-[oklch(0.78_0.18_145)]"
                style={{ width: `${resolutividadeMes}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-[oklch(0.22_0.05_258)] to-[oklch(0.32_0.1_245)] text-white p-5 sm:p-6 shadow-elegant relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[oklch(0.6_0.16_230)]/30 blur-3xl pointer-events-none" />

          <div className="relative">
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-[oklch(0.78_0.18_145)] mb-4">
              Acervo Processual
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="text-4xl sm:text-5xl font-bold font-display tabular-nums leading-none">{total}</div>
                <p className="text-lg sm:text-xl text-white/85 mt-3">Processos cadastrados</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">DU: {totalDU}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">PA: {totalPA}</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">Ativos: {ativos}</span>
                </div>
              </div>

              <div>
                <div className="flex items-end gap-2 leading-none">
                  <span className="text-3xl sm:text-4xl font-bold text-[oklch(0.78_0.18_145)] mb-1">{taxaSucesso}%</span>
                  <span className="text-lg font-bold font-display tabular-nums text-[oklch(0.78_0.18_145)]">
                    {concluidos}
                  </span>
                </div>
                <p className="text-lg sm:text-xl text-white/85 mt-3">Finalizados</p>
                <p className="text-base text-white/60 mt-0.5">{taxaSucesso}% do total cadastrado</p>

                <div className="mt-4 h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[oklch(0.78_0.18_145)]"
                    style={{ width: `${taxaSucesso}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <ChartCard
          title="Distribuição por status (safra recente)"
          subtitle="Reflete o cache local: ativos + últimos 50 concluídos (não o histórico global)"
          icon={TrendingUp}
        >
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={dadosStatus}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
              >
                {dadosStatus.map((d, i) => (
                  <Cell key={i} fill={d.fill} stroke="oklch(1 0 0)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Saúde dos prazos"
          subtitle="Distribuição de urgência (ativos)"
          icon={AlertTriangle}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dadosPrazos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip cursor={{ fill: "oklch(0.95 0 0 / 0.5)" }} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={42}>
                {dadosPrazos.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Gráficos linha 2 */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <ChartCard
          title="Performance por responsável"
          subtitle="Top 6 — ativos vs concluídos"
          icon={Award}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={dadosResponsavel}
              layout="vertical"
              margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip cursor={{ fill: "oklch(0.95 0 0 / 0.5)" }} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              <Bar dataKey="ativos" stackId="a" fill={ACCENT} name="Ativos" />
              <Bar
                dataKey="concluidos"
                stackId="a"
                fill={ACCENT_LIME}
                radius={[0, 8, 8, 0]}
                name="Concluídos"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Linha de cadastros"
          subtitle="Cadastros por mês (últimos 6 meses)"
          icon={Clock}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dadosCadastros} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT_LIME} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={ACCENT_LIME} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: AXIS_COLOR }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="cadastros"
                stroke={ACCENT_LIME}
                strokeWidth={2.5}
                fill="url(#grad-area)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tipos de ação */}
      <ChartCard
        title="Tipos de ação mais comuns"
        subtitle="Top 5 categorias"
        icon={TrendingUp}
      >
        {dadosTipoAcao.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
        ) : (
          <div className="space-y-3.5 py-2">
            {dadosTipoAcao.map((d, i) => {
              const max = dadosTipoAcao[0].value;
              const pct = (d.value / max) * 100;
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-foreground truncate pr-2">{d.name}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0 font-bold">
                      {d.value}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-accent transition-all"
                      style={{
                        width: `${pct}%`,
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function KpiHero({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  isText,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  sub: string;
  tone: "primary" | "success" | "danger" | "info";
  isText?: boolean;
  accent?: boolean;
}) {
  const tones = {
    primary: { bg: "bg-[oklch(0.6_0.16_230_/_0.12)]", text: "text-[oklch(0.6_0.16_230)]" },
    success: { bg: "bg-[var(--deadline-safe-bg)]", text: "text-[var(--deadline-safe)]" },
    danger: { bg: "bg-[var(--deadline-overdue-bg)]", text: "text-[var(--deadline-overdue)]" },
    info: { bg: "bg-[oklch(0.62_0.22_305_/_0.12)]", text: "text-[oklch(0.62_0.22_305)]" },
  }[tone];

  return (
    <div
      className={`rounded-3xl border p-5 shadow-card animate-fade-in-up ${
        accent ? "bg-accent border-accent" : "bg-card border-border"
      }`}
    >
      <span
        className={`inline-flex h-11 w-11 rounded-2xl items-center justify-center mb-3 ${
          accent ? "bg-accent-foreground/10" : tones.bg
        }`}
      >
        <Icon className={`h-5 w-5 ${accent ? "text-accent-foreground" : tones.text}`} />
      </span>
      <div
        className={`font-bold tracking-tight font-display ${
          accent ? "text-accent-foreground" : "text-foreground"
        } ${isText ? "text-lg sm:text-xl truncate" : "text-2xl sm:text-3xl tabular-nums"}`}
      >
        {value}
      </div>
      <p
        className={`text-sm font-bold mt-1 ${
          accent ? "text-accent-foreground" : "text-foreground"
        }`}
      >
        {label}
      </p>
      <p
        className={`text-[11px] mt-0.5 ${
          accent ? "text-accent-foreground/70" : "text-muted-foreground"
        }`}
      >
        {sub}
      </p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof TrendingUp;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-card animate-fade-in-up">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-foreground text-base flex items-center gap-2 font-display">
            <span className="inline-flex h-7 w-7 rounded-lg bg-accent/30 items-center justify-center">
              <Icon className="h-4 w-4 text-accent-foreground" />
            </span>
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 ml-9">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
