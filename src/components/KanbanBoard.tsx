import { useState } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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

interface ColunaProps {
  status: StatusProcesso;
  titulo: string;
  descricao: string;
  itens: Processo[];
  isOver: boolean;
  index: number;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onAdd: (status: StatusProcesso) => void;
}

const COLUNA_COLORS: Record<StatusProcesso, string> = {
  novo: "oklch(0.78 0.16 220)",
  andamento: "oklch(0.7 0.22 305)",
  audiencia: "oklch(0.82 0.2 60)",
  recurso: "oklch(0.72 0.24 22)",
  concluido: "oklch(0.78 0.18 160)",
};

function Coluna({
  status,
  titulo,
  descricao,
  itens,
  isOver,
  index,
  onEdit,
  onDelete,
  onMove,
  onAdd,
}: ColunaProps) {
  const { setNodeRef } = useDroppable({ id: `col:${status}`, data: { status } });
  const color = COLUNA_COLORS[status];

  return (
    <div
      style={{ animationDelay: `${index * 80}ms` }}
      className={`shrink-0 w-[88vw] sm:w-80 snap-start flex flex-col rounded-xl border bg-card/40 backdrop-blur transition-all animate-fade-in-up overflow-hidden ${
        isOver
          ? "border-primary/60 ring-2 ring-primary/30 shadow-glow"
          : "border-border"
      }`}
    >
      {/* top accent bar */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card/60">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
          <div className="min-w-0">
            <h2 className="font-semibold text-[13px] text-foreground tracking-tight uppercase font-mono-tech leading-none">
              {titulo}
            </h2>
            <p className="text-[9px] text-muted-foreground/70 mt-0.5 truncate">{descricao}</p>
          </div>
          <span
            className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-md text-[10px] font-bold font-mono-tech tabular-nums"
            style={{
              color,
              backgroundColor: `color-mix(in oklab, ${color} 15%, transparent)`,
              border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`,
            }}
          >
            {String(itens.length).padStart(2, "0")}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 hover:bg-primary/10 hover:text-primary"
          onClick={() => onAdd(status)}
          aria-label={`Adicionar em ${titulo}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 min-h-[140px] max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin transition-colors ${
          isOver ? "bg-primary/5" : ""
        }`}
      >
        <SortableContext
          items={itens.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {itens.length === 0 ? (
            <button
              onClick={() => onAdd(status)}
              className={`w-full rounded-lg border-2 border-dashed py-8 text-xs transition-colors font-mono-tech uppercase tracking-wider ${
                isOver
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border/50 text-muted-foreground/60 hover:border-primary/40 hover:text-primary"
              }`}
            >
              {isOver ? "▼ soltar aqui" : "+ adicionar"}
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
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({ processos, onEdit, onDelete, onMove, onAdd }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<StatusProcesso | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeProcesso = activeId ? processos.find((p) => p.id === activeId) ?? null : null;

  function resolveColuna(overId: string | null): StatusProcesso | null {
    if (!overId) return null;
    if (overId.startsWith("col:")) {
      return overId.slice(4) as StatusProcesso;
    }
    const p = processos.find((x) => x.id === overId);
    return p ? p.status : null;
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const overId = e.over ? String(e.over.id) : null;
    setOverColumn(resolveColuna(overId));
  }

  function handleDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    const target = resolveColuna(overId);
    const atual = processos.find((p) => p.id === id);
    if (target && atual && atual.status !== target) {
      onMove(id, target);
    }
    setActiveId(null);
    setOverColumn(null);
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverColumn(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
        {COLUNAS.map((col, i) => {
          const itens = processos.filter((p) => p.status === col.id);
          return (
            <Coluna
              key={col.id}
              status={col.id}
              titulo={col.titulo}
              descricao={col.descricao}
              itens={itens}
              index={i}
              isOver={overColumn === col.id && activeId !== null}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onAdd={onAdd}
            />
          );
        })}
      </div>

      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeProcesso ? (
          <div className="w-80">
            <ProcessoCard
              processo={activeProcesso}
              onEdit={() => {}}
              onDelete={() => {}}
              onMove={() => {}}
              overlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
