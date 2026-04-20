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
  itens: Processo[];
  isOver: boolean;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onAdd: (status: StatusProcesso) => void;
}

function Coluna({ status, titulo, itens, isOver, onEdit, onDelete, onMove, onAdd }: ColunaProps) {
  const { setNodeRef } = useDroppable({ id: `col:${status}`, data: { status } });

  return (
    <div
      className={`shrink-0 w-[88vw] sm:w-80 snap-start flex flex-col rounded-xl border transition-colors ${
        isOver
          ? "bg-primary/5 border-primary/40 ring-2 ring-primary/20"
          : "bg-muted/60 border-border"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm text-foreground">{titulo}</h2>
          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full bg-background text-[11px] font-medium text-muted-foreground border border-border">
            {itens.length}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onAdd(status)}
          aria-label={`Adicionar em ${titulo}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-22rem)] overflow-y-auto"
      >
        <SortableContext
          items={itens.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {itens.length === 0 ? (
            <button
              onClick={() => onAdd(status)}
              className={`w-full rounded-lg border-2 border-dashed py-6 text-xs transition-colors ${
                isOver
                  ? "border-primary text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
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
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none">
        {COLUNAS.map((col) => {
          const itens = processos.filter((p) => p.status === col.id);
          return (
            <Coluna
              key={col.id}
              status={col.id}
              titulo={col.titulo}
              itens={itens}
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
