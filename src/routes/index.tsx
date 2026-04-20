import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Scale,
  Plus,
  Search,
  LayoutGrid,
  BarChart3,
  Bell,
  Briefcase,
  Menu,
  X,
  Settings,
  HelpCircle,
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
      { title: "JurisBoard — Controle de Processos Jurídicos" },
      {
        name: "description",
        content:
          "Plataforma premium para escritórios de advocacia: Kanban de processos, alertas de prazo e dashboard de resultados em tempo real.",
      },
      { property: "og:title", content: "JurisBoard — Controle de Processos Jurídicos" },
      {
        property: "og:description",
        content:
          "Quadro Kanban para advogados com prazos coloridos, estatísticas e gráficos de performance do escritório.",
      },
    ],
  }),
  component: Index,
});

type Aba = "quadro" | "estatisticas";

function Index() {
  const { processos, criar, atualizar, remover, moverStatus } = useProcessos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<StatusProcesso>("novo");
  const [filtro, setFiltro] = useState<FiltroPrazo>("todos");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("quadro");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
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
  }, [processos, filtro, busca]);

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

  const navItems: { id: Aba; label: string; icon: typeof LayoutGrid; badge?: number }[] = [
    { id: "quadro", label: "Quadro Kanban", icon: LayoutGrid, badge: ativosCount },
    { id: "estatisticas", label: "Estatísticas", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background bg-mesh">
      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } pattern-grid`}
      >
        <div className="relative flex flex-col h-full">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-accent blur-md opacity-70" />
                <div className="relative h-10 w-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow">
                  <Scale className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight leading-none font-mono-tech">
                  JURIS<span className="text-gradient-accent">BOARD</span>
                </h1>
                <p className="text-[9px] text-sidebar-foreground/50 mt-1 tracking-[0.25em] uppercase font-mono-tech">
                  v2.0 · TECH CONSOLE
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
          <nav className="flex-1 px-3 py-4 space-y-1">
            <p className="px-3 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
              Workspace
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = aba === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setAba(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-[var(--transition-smooth)] group relative ${
                    active
                      ? "bg-gradient-to-r from-sidebar-accent to-sidebar-accent/40 text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-sidebar-primary" />}
                  <Icon className={`h-4 w-4 ${active ? "text-sidebar-primary" : ""}`} />
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "bg-sidebar-accent text-sidebar-foreground"}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <p className="px-3 pt-6 pb-2 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">
              Geral
            </p>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
              <Settings className="h-4 w-4" />
              <span className="font-medium">Configurações</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
              <HelpCircle className="h-4 w-4" />
              <span className="font-medium">Ajuda</span>
            </button>
          </nav>

          {/* Footer card */}
          <div className="p-3">
            <div className="rounded-xl bg-gradient-to-br from-sidebar-accent to-sidebar-accent/30 p-4 border border-sidebar-border">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-sidebar-primary" />
                <p className="text-xs font-semibold">Resumo do dia</p>
              </div>
              <p className="text-[11px] text-sidebar-foreground/70 leading-relaxed">
                <span className="font-bold text-sidebar-foreground">{ativosCount}</span> processos ativos
                {vencidosCount > 0 && (
                  <>
                    {" • "}
                    <span className="font-bold text-[oklch(0.78_0.16_45)]">{vencidosCount}</span> vencidos
                  </>
                )}
              </p>
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
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-gradient-header text-primary-foreground shadow-elegant">
          <div className="absolute inset-0 pattern-grid opacity-50 pointer-events-none" />
          <div className="relative px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 text-primary-foreground hover:bg-white/10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden sm:block">
              <h2 className="font-bold text-lg sm:text-xl tracking-tight leading-none">
                {aba === "quadro" ? "Quadro de Processos" : "Estatísticas & Resultados"}
              </h2>
              <p className="text-xs text-primary-foreground/70 mt-1">
                {aba === "quadro"
                  ? "Acompanhe seus processos em tempo real"
                  : "Performance do escritório em números"}
              </p>
            </div>

            {/* Busca */}
            <div className="flex-1 max-w-md ml-auto sm:ml-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-foreground/60" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar processo, cliente..."
                  className="pl-9 h-10 bg-white/10 border-white/20 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:bg-white/15 focus-visible:ring-white/30"
                />
              </div>
            </div>

            {/* Notificações + CTA */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-10 w-10 text-primary-foreground hover:bg-white/10 shrink-0"
            >
              <Bell className="h-4.5 w-4.5" />
              {vencidosCount > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[oklch(0.78_0.18_50)] ring-2 ring-[oklch(0.2_0.06_258)] animate-pulse-soft" />
              )}
            </Button>

            <Button
              onClick={() => handleAdd("novo")}
              className="bg-gradient-accent text-accent-foreground hover:shadow-glow hover:scale-[1.02] active:scale-100 transition-all font-semibold shrink-0 shadow-md"
            >
              <Plus className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Novo processo</span>
            </Button>
          </div>

          {/* Tabs (mobile) */}
          <div className="relative flex sm:hidden border-t border-white/10 px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = aba === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setAba(item.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    active
                      ? "border-accent text-primary-foreground"
                      : "border-transparent text-primary-foreground/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </header>

        {/* Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
          {aba === "quadro" ? (
            <>
              <Dashboard
                processos={processos}
                filtro={filtro}
                onFiltroChange={setFiltro}
              />

              {filtro !== "todos" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Filtro ativo:</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                    {filtro === "vencidos" && "Vencidos"}
                    {filtro === "hoje" && "Vencem hoje"}
                    {filtro === "semana" && "Próximos 7 dias"}
                    <button
                      onClick={() => setFiltro("todos")}
                      className="hover:bg-primary/20 rounded-full p-0.5 -mr-1"
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
