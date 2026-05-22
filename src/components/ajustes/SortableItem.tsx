import React, { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SortableAssuntoRow({ id, value, placeholder, onChange, onDelete }: { id: string; value: string; placeholder: string; onChange: (v: string) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col gap-2 sm:flex-row sm:items-center transition-[box-shadow,opacity] duration-200 ${isDragging ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-2 flex-1">
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </Button>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
      <Button type="button" variant="outline" onClick={onDelete} className="shrink-0"><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>
    </div>
  );
}

export function AssuntoDragPreview({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-2xl">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

export function SortableFlowActionCard({ id, children, onClick, selected = false }: { id: string; children: ReactNode; onClick?: () => void; selected?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "opacity-70" : ""} ${selected ? "ring-2 ring-sky-200 rounded-lg" : ""} cursor-pointer`} onClick={onClick}>
      <div className="mb-2 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </Button>
        <span className="text-[11px] text-muted-foreground">Arraste para reordenar o fluxo</span>
      </div>
      {children}
    </div>
  );
}