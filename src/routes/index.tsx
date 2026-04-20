import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Scale, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProcessos } from "@/hooks/useProcessos";
import { Dashboard } from "@/components/Dashboard";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ProcessoDialog } from "@/components/ProcessoDialog";
import type { Processo, StatusProcesso, FiltroPrazo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JurisBoard — Controle de Processos Jurídicos" },
      {
        name: "description",
        content:
          "Gerencie processos jurídicos em quadro Kanban com alertas visuais de prazos, dashboard de pendências e fluxo por fase processual.",
      },
      { property: "og:title", content: "JurisBoard — Controle de Processos Jurídicos" },
      {
        property: "og:description",
        content:
          "Quadro Kanban para advogados: prazos com alerta de cor, contagem regressiva e dashboard de processos.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { processos, criar, atualizar, remover, moverStatus } = useProcessos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<StatusProcesso>("novo");
  const [filtro, setFiltro] = useState<FiltroPrazo>("todos");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
      // busca textual
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="border-b border-border text-primary-foreground"
        style={{ backgroundImage: "var(--gradient-header)" }}
      >
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-white/10 p-2 shrink-0">
              <Scale className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg sm:text-xl tracking-tight truncate">
                JurisBoard
              </h1>
              <p className="text-xs text-primary-foreground/70 hidden sm:block">
                Controle de processos jurídicos
              </p>
            </div>
          </div>
          <Button
            onClick={() => handleAdd("novo")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Novo processo</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        {/* Dashboard */}
        <Dashboard processos={processos} filtro={filtro} onFiltroChange={setFiltro} />

        {/* Busca */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº, cliente, responsável..."
              className="pl-9"
            />
          </div>
          {filtro !== "todos" && (
            <Button variant="outline" size="sm" onClick={() => setFiltro("todos")}>
              Limpar filtro
            </Button>
          )}
        </div>

        {/* Kanban */}
        <KanbanBoard
          processos={filtrados}
          onEdit={handleEdit}
          onDelete={remover}
          onMove={moverStatus}
          onAdd={handleAdd}
        />
      </main>

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
