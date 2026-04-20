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
  novo: "oklch(0.6 0.16 230)",
  andamento: "oklch(0.62 0.22 305)",
  audiencia: "oklch(0.7 0.17 50)",
  recurso: "oklch(0.58 0.22 25)",
  concluido: "oklch(0.6 0.15 155)",
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
      className={`shrink-0 w-[88vw] sm:w-80 snap-start flex flex-col rounded-3xl border bg-card transition-all animate-fade-in-up overflow-hidden shadow-card ${
        isOver
          ? "border-accent ring-2 ring-accent/50 shadow-card-hover"
          : "border-border"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0">
            <h2 className="font-bold text-sm text-foreground tracking-tight leading-none">
              {titulo}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{descricao}</p>
          </div>
          <span
            className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold tabular-nums bg-muted text-foreground"
          >
            {itens.length}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 rounded-full hover:bg-accent hover:text-accent-foreground"
          onClick={() => onAdd(status)}
          aria-label={`Adicionar em ${titulo}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 p-3 space-y-2.5 min-h-[140px] max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin transition-colors ${
          isOver ? "bg-accent/10" : ""
        }`}
      >
        <SortableContext
          items={itens.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {itens.length === 0 ? (
            <button
              onClick={() => onAdd(status)}
              className={`w-full rounded-2xl border-2 border-dashed py-10 text-xs font-semibold transition-colors ${
                isOver
                  ? "border-accent text-accent-foreground bg-accent/10"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              {isOver ? "Soltar aqui" : "+ Adicionar processo"}
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
