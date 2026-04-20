import { useMemo } from "react";
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
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, Award, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { Processo } from "@/types/processo";
import { COLUNAS } from "@/types/processo";
import { statusPrazo, diasRestantes } from "@/lib/prazo";

interface Props {
  processos: Processo[];
}

const STATUS_COLORS: Record<string, string> = {
  novo: "oklch(0.78 0.16 220)",
  andamento: "oklch(0.7 0.22 305)",
  audiencia: "oklch(0.82 0.2 60)",
  recurso: "oklch(0.72 0.24 22)",
  concluido: "oklch(0.78 0.18 160)",
};

const TOOLTIP_STYLE = {
  backgroundColor: "oklch(0.21 0.025 260)",
  border: "1px solid oklch(1 0 0 / 0.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "oklch(0.96 0.01 240)",
  boxShadow: "0 8px 32px oklch(0 0 0 / 0.5)",
} as const;

const AXIS_COLOR = "oklch(0.7 0.03 245)";
const GRID_COLOR = "oklch(1 0 0 / 0.06)";

export function Estatisticas({ processos }: Props) {
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
        fill: "oklch(0.72 0.24 22)",
      },
      {
        name: "Hoje",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "today").length,
        fill: "oklch(0.82 0.2 60)",
      },
      {
        name: "Em breve",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "soon").length,
        fill: "oklch(0.85 0.18 95)",
      },
      {
        name: "Em dia",
        value: ativos.filter((p) => statusPrazo(p.prazo) === "safe").length,
        fill: "oklch(0.78 0.18 160)",
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
    const map = new Map<string, number>();
    processos.forEach((p) => {
      const t = p.tipoAcao || "Outros";
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [processos]);

  // Distribuição de prazos por faixa de dias (linha do tempo)
  const dadosTimeline = useMemo(() => {
    const bins = [
      { name: "Vencidos", min: -Infinity, max: -1 },
      { name: "0-3 dias", min: 0, max: 3 },
      { name: "4-7 dias", min: 4, max: 7 },
      { name: "8-15 dias", min: 8, max: 15 },
      { name: "16-30 dias", min: 16, max: 30 },
      { name: "30+ dias", min: 31, max: Infinity },
    ];
    return bins.map((b) => ({
      name: b.name,
      processos: processos.filter((p) => {
        if (p.status === "concluido") return false;
        const d = diasRestantes(p.prazo);
        return d >= b.min && d <= b.max;
      }).length,
    }));
  }, [processos]);

  const total = processos.length;
  const concluidos = processos.filter((p) => p.status === "concluido").length;
  const ativos = total - concluidos;
  const vencidos = processos.filter((p) => p.status !== "concluido" && statusPrazo(p.prazo) === "overdue").length;
  const taxaSucesso = total ? Math.round((concluidos / total) * 100) : 0;
  const topResp = dadosResponsavel[0];

  return (
    <div className="space-y-6">
      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiHero
          icon={CheckCircle2}
          label="Taxa de conclusão"
          value={`${taxaSucesso}%`}
          sub={`${concluidos} de ${total} processos`}
          tone="success"
        />
        <KpiHero
          icon={Clock}
          label="Processos ativos"
          value={ativos}
          sub="Em acompanhamento"
          tone="primary"
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
          tone="accent"
          isText
        />
      </div>

      {/* Gráficos linha 1 */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title="Distribuição por status"
          subtitle="Processos em cada fase do fluxo"
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
                  <Cell key={i} fill={d.fill} stroke="oklch(0.21 0.025 260)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.21 0.025 260)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "var(--shadow-card-hover)",
                }}
              />
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
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.7 0.03 245)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.7 0.03 245)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                contentStyle={{
                  backgroundColor: "oklch(0.21 0.025 260)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "var(--shadow-card-hover)",
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {dadosPrazos.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Gráficos linha 2 */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title="Performance por responsável"
          subtitle="Top 6 — ativos vs concluídos"
          icon={Award}
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dadosResponsavel} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.7 0.03 245)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.7 0.03 245)" }} axisLine={false} tickLine={false} width={110} />
              <Tooltip
                cursor={{ fill: "oklch(1 0 0 / 0.04)" }}
                contentStyle={{
                  backgroundColor: "oklch(0.21 0.025 260)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "var(--shadow-card-hover)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              <Bar dataKey="ativos" stackId="a" fill="oklch(0.78 0.16 220)" radius={[0, 0, 0, 0]} name="Ativos" />
              <Bar dataKey="concluidos" stackId="a" fill="oklch(0.78 0.18 160)" radius={[0, 8, 8, 0]} name="Concluídos" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Linha de prazos"
          subtitle="Quando os prazos vencem"
          icon={Clock}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dadosTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.16 220)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="oklch(0.78 0.16 220)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.7 0.03 245)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "oklch(0.7 0.03 245)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.21 0.025 260)",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "var(--shadow-card-hover)",
                }}
              />
              <Area
                type="monotone"
                dataKey="processos"
                stroke="oklch(0.78 0.16 220)"
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
        subtitle="Top 5 categorias do escritório"
        icon={TrendingUp}
      >
        {dadosTipoAcao.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem dados.</p>
        ) : (
          <div className="space-y-3 py-2">
            {dadosTipoAcao.map((d, i) => {
              const max = dadosTipoAcao[0].value;
              const pct = (d.value / max) * 100;
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground truncate pr-2">{d.name}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">{d.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden border border-border/50">
                    <div
                      className="h-full rounded-full bg-gradient-accent transition-all"
                      style={{
                        width: `${pct}%`,
                        animationDelay: `${i * 100}ms`,
                        boxShadow: "0 0 12px oklch(0.78 0.16 220 / 0.5)",
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
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string | number;
  sub: string;
  tone: "primary" | "success" | "danger" | "accent";
  isText?: boolean;
}) {
  const tones = {
    primary: { bg: "bg-primary/10", text: "text-primary-glow", glow: "from-primary-glow/20" },
    success: { bg: "bg-[var(--deadline-safe-bg)]", text: "text-[var(--deadline-safe)]", glow: "from-[var(--deadline-safe)]/20" },
    danger: { bg: "bg-[var(--deadline-overdue-bg)]", text: "text-[var(--deadline-overdue)]", glow: "from-[var(--deadline-overdue)]/20" },
    accent: { bg: "bg-accent/15", text: "text-accent-foreground", glow: "from-accent/30" },
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up">
      <div className={`pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-to-br ${tones.glow} to-transparent blur-2xl`} />
      <div className="relative">
        <span className={`inline-flex rounded-xl p-2.5 ${tones.bg} mb-3`}>
          <Icon className={`h-5 w-5 ${tones.text}`} />
        </span>
        <div className={`font-bold text-foreground tracking-tight ${isText ? "text-xl truncate" : "text-3xl sm:text-4xl tabular-nums"}`}>
          {value}
        </div>
        <p className="text-xs sm:text-sm text-foreground font-semibold mt-1">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
      </div>
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] animate-fade-in-up">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary-glow" />
            {title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
