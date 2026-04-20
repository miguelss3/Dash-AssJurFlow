import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Scale,
  Plus,
  Search,
  LayoutGrid,
  BarChart3,
  Bell,
  Menu,
  X,
  Settings,
  HelpCircle,
  Calendar,
  History,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProcessos } from "@/hooks/useProcessos";
import { Dashboard } from "@/components/Dashboard";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ProcessoDialog } from "@/components/ProcessoDialog";
import { Estatisticas } from "@/components/Estatisticas";
import type { Processo, StatusProcesso, FiltroPrazo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JurisBoard — Painel de Controle Jurídico" },
      {
        name: "description",
        content:
          "Mesa de trabalho e acompanhamento de processos jurídicos com Kanban, alertas de prazo e dashboard de resultados.",
      },
      { property: "og:title", content: "JurisBoard — Painel de Controle Jurídico" },
      {
        property: "og:description",
        content:
          "Quadro Kanban para advogados com prazos coloridos, estatísticas e gráficos de performance.",
      },
    ],
  }),
  component: Index,
});

type Aba = "quadro" | "estatisticas";
type FiltroTipo = "todos" | "DU" | "PA";

function Index() {
  const { processos, criar, atualizar, remover, moverStatus } = useProcessos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<StatusProcesso>("novo");
  const [filtro, setFiltro] = useState<FiltroPrazo>("todos");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("quadro");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
      if (filtroTipo !== "todos" && p.tipo !== filtroTipo) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hit =
          p.numero.toLowerCase().includes(q) ||
          p.cliente.toLowerCase().includes(q) ||
          p.parteContraria.toLowerCase().includes(q) ||
          p.responsavel.toLowerCase().includes(q) ||
          p.tipoAcao.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filtro === "todos") return true;
      if (p.status === "concluido") return false;
      const s = statusPrazo(p.prazo);
      if (filtro === "vencidos") return s === "overdue";
      if (filtro === "hoje") return s === "today";
      if (filtro === "semana") return s === "today" || s === "soon";
      return true;
    });
  }, [processos, filtro, busca, filtroTipo]);

  const ativosCount = processos.filter((p) => p.status !== "concluido").length;
  const vencidosCount = processos.filter(
    (p) => p.status !== "concluido" && statusPrazo(p.prazo) === "overdue",
  ).length;

  const handleEdit = (p: Processo) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const handleAdd = (status: StatusProcesso) => {
    setEditing(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const handleSave = (dados: Omit<Processo, "id" | "criadoEm">) => {
    if (editing) atualizar(editing.id, dados);
    else criar(dados);
  };

  const navMain: { id: Aba; label: string; icon: typeof LayoutGrid; badge?: number }[] = [
    { id: "quadro", label: "Painel de Controle", icon: LayoutGrid, badge: ativosCount },
    { id: "estatisticas", label: "Indicadores", icon: BarChart3 },
  ];

  const navSec: { label: string; icon: typeof LayoutGrid }[] = [
    { label: "Controle de Prazos", icon: Calendar },
    { label: "Processos Antigos", icon: History },
  ];

  const subAbas: { id: FiltroTipo; label: string }[] = [
    { id: "todos", label: "Visão do setor" },
    { id: "DU", label: "DU" },
    { id: "PA", label: "PA" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 py-7 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-sidebar-primary flex items-center justify-center shadow-lg shrink-0">
                <Scale className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight leading-none font-display">
                  JurisBoard
                </h1>
                <p className="text-[10px] text-sidebar-foreground/50 mt-1.5 tracking-[0.2em] uppercase font-semibold">
                  Painel Jurídico
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-thin">
            {navMain.map((item) => {
              const Icon = item.icon;
              const active = aba === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setAba(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm transition-[var(--transition-smooth)] ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-lg"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        active
                          ? "bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground"
                          : "bg-sidebar-accent text-sidebar-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {navSec.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}

            <div className="pt-6 mt-2 border-t border-sidebar-border space-y-1.5">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                <Settings className="h-4.5 w-4.5" />
                <span>Configurações</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
                <HelpCircle className="h-4.5 w-4.5" />
                <span>Ajuda</span>
              </button>
            </div>
          </nav>

          {/* Footer status */}
          <div className="p-4">
            <div className="rounded-2xl bg-sidebar-accent p-4 border border-sidebar-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-sidebar-primary animate-pulse" />
                <p className="text-[10px] uppercase tracking-wider text-sidebar-foreground/70 font-bold">
                  Sistema online
                </p>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-sidebar-primary font-display">
                  {String(ativosCount).padStart(2, "0")}
                </span>
                <span className="text-[11px] text-sidebar-foreground/60 uppercase tracking-wider">
                  ativos
                </span>
              </div>
              {vencidosCount > 0 && (
                <p className="mt-1.5 text-[11px] text-[oklch(0.78_0.16_50)] flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.16_50)] animate-pulse" />
                  {vencidosCount} vencido{vencidosCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===================== MAIN ===================== */}
      <div className="lg:pl-72">
        {/* Header card branco — estilo AssJur */}
        <header className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          <div className="bg-card rounded-3xl shadow-card border border-border p-4 sm:p-6">
            <div className="flex items-start sm:items-center gap-3 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-9 w-9 shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-2xl sm:text-3xl tracking-tight leading-tight font-display text-foreground">
                  {aba === "quadro" ? "Painel de Controle" : "Indicadores de Gestão"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
                  {aba === "quadro"
                    ? "Mesa de trabalho e acompanhamento dos processos em andamento"
                    : "Análise de performance e métricas do setor"}
                </p>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 ml-auto shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-11 w-11 rounded-full bg-muted hover:bg-secondary"
                >
                  <Bell className="h-4.5 w-4.5 text-foreground" />
                  {vencidosCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card animate-pulse-soft" />
                  )}
                </Button>

                <Button
                  onClick={() => handleAdd("novo")}
                  className="h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary-glow font-semibold px-5 shadow-md"
                >
                  <Plus className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Novo Processo</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-5 space-y-5 max-w-[1600px] mx-auto">
          {aba === "quadro" ? (
            <>
              {/* Sub-abas DU/PA + busca (estilo AssJur) */}
              <div className="bg-card rounded-3xl shadow-card border border-border p-4 sm:p-5 space-y-4">
                {/* Tabs DU/PA */}
                <div className="flex gap-2 overflow-x-auto scrollbar-thin">
                  {subAbas.map((s) => {
                    const active = filtroTipo === s.id;
                    const isDU = s.id === "DU";
                    const isPA = s.id === "PA";
                    return (
                      <button
                        key={s.id}
                        onClick={() => setFiltroTipo(s.id)}
                        className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                          active
                            ? s.id === "todos"
                              ? "bg-card text-foreground shadow-card border border-border"
                              : isDU
                                ? "bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border border-[var(--tipo-du)]/30"
                                : "bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border border-[var(--tipo-pa)]/30"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                {/* Busca + chips */}
                <div className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar processo, parte, assunto..."
                      className="pl-11 h-12 rounded-full bg-muted border-transparent focus-visible:bg-card focus-visible:border-border focus-visible:ring-accent text-sm"
                    />
                  </div>
                  <div className="hidden sm:flex gap-1.5 shrink-0">
                    {(["todos", "DU", "PA"] as FiltroTipo[]).map((t) => {
                      const active = filtroTipo === t;
                      const isDU = t === "DU";
                      const isPA = t === "PA";
                      return (
                        <button
                          key={t}
                          onClick={() => setFiltroTipo(t)}
                          className={`px-4 h-12 rounded-full text-sm font-bold transition-all border ${
                            active
                              ? t === "todos"
                                ? "bg-primary text-primary-foreground border-primary"
                                : isDU
                                  ? "bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border-[var(--tipo-du)]/30"
                                  : "bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border-[var(--tipo-pa)]/30"
                              : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                          }`}
                        >
                          {t === "todos" ? "Todos" : t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <Dashboard
                processos={processos}
                filtro={filtro}
                onFiltroChange={setFiltro}
              />

              {filtro !== "todos" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Filtro de prazo:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground font-bold border border-accent">
                    {filtro === "vencidos" && "Vencidos"}
                    {filtro === "hoje" && "Vencem hoje"}
                    {filtro === "semana" && "Próximos 7 dias"}
                    <button
                      onClick={() => setFiltro("todos")}
                      className="hover:bg-foreground/10 rounded-full p-0.5 -mr-1"
                      aria-label="Limpar filtro"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              )}

              <KanbanBoard
                processos={filtrados}
                onEdit={handleEdit}
                onDelete={remover}
                onMove={moverStatus}
                onAdd={handleAdd}
              />
            </>
          ) : (
            <Estatisticas processos={processos} />
          )}
        </main>
      </div>

      <ProcessoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        processo={editing}
        defaultStatus={defaultStatus}
        onSave={handleSave}
      />
    </div>
  );
}
