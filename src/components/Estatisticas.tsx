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

  const dadosTimeline = useMemo(() => {
    const bins = [
      { name: "Vencidos", min: -Infinity, max: -1 },
      { name: "0-3d", min: 0, max: 3 },
      { name: "4-7d", min: 4, max: 7 },
      { name: "8-15d", min: 8, max: 15 },
      { name: "16-30d", min: 16, max: 30 },
      { name: "30+d", min: 31, max: Infinity },
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
  const vencidos = processos.filter(
    (p) => p.status !== "concluido" && statusPrazo(p.prazo) === "overdue",
  ).length;
  const taxaSucesso = total ? Math.round((concluidos / total) * 100) : 0;
  const topResp = dadosResponsavel[0];

  return (
    <div className="space-y-5">
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

      {/* Gráficos linha 1 */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
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
          title="Linha de prazos"
          subtitle="Quando os prazos vencem"
          icon={Clock}
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dadosTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                dataKey="processos"
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
        } ${isText ? "text-xl truncate" : "text-3xl sm:text-4xl tabular-nums"}`}
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
