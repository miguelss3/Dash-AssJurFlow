import { Plus } from "lucide-react";
import type { Processo, StatusProcesso } from "@/types/processo";
import { COLUNAS } from "@/types/processo";
import { ProcessoCard } from "./ProcessoCard";
import { Button } from "@/components/ui/button";

interface Props {
  processos: Processo[];
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onAdd: (status: StatusProcesso) => void;
}

export function KanbanBoard({ processos, onEdit, onDelete, onMove, onAdd }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none">
      {COLUNAS.map((col) => {
        const itens = processos.filter((p) => p.status === col.id);
        return (
          <div
            key={col.id}
            className="shrink-0 w-[88vw] sm:w-80 snap-start flex flex-col rounded-xl bg-muted/60 border border-border"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-sm text-foreground">{col.titulo}</h2>
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-background text-[11px] font-medium text-muted-foreground border border-border">
                  {itens.length}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onAdd(col.id)}
                aria-label={`Adicionar em ${col.titulo}`}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-22rem)] overflow-y-auto">
              {itens.length === 0 ? (
                <button
                  onClick={() => onAdd(col.id)}
                  className="w-full rounded-lg border-2 border-dashed border-border py-6 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  + Adicionar processo
                </button>
              ) : (
                itens.map((p) => (
                  <ProcessoCard
                    key={p.id}
                    processo={p}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
