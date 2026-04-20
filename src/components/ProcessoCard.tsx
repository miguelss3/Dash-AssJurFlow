import { Calendar, Building2, User, Scale, MoreVertical, Pencil, Trash2, ArrowRight, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Processo, StatusProcesso } from "@/types/processo";
import { COLUNAS } from "@/types/processo";
import { classesPrazo, formatarData, rotuloPrazo, statusPrazo } from "@/lib/prazo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface Props {
  processo: Processo;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  /** Render como overlay (sem sortable, sem interações). */
  overlay?: boolean;
}

export function ProcessoCard({ processo, onEdit, onDelete, onMove, overlay = false }: Props) {
  const status = statusPrazo(processo.prazo);
  const cls = classesPrazo(status);

  const sortable = useSortable({
    id: processo.id,
    data: { processo },
    disabled: overlay,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`group relative rounded-lg bg-card border border-border border-l-4 ${cls.border} p-3 shadow-[var(--shadow-card)] transition-[box-shadow,transform] ${
        overlay
          ? "shadow-[var(--shadow-card-hover)] rotate-2 cursor-grabbing"
          : isDragging
            ? "opacity-30"
            : "hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 cursor-pointer"
      }`}
      onClick={overlay ? undefined : () => onEdit(processo)}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-1.5 flex-1 min-w-0">
          {!overlay && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label="Arrastar processo"
              className="shrink-0 -ml-1 mt-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono text-muted-foreground truncate">
              {processo.numero}
            </p>
            <h3 className="font-semibold text-sm text-foreground leading-tight mt-0.5 line-clamp-2">
              {processo.cliente}
            </h3>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(processo)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRight className="mr-2 h-4 w-4" /> Mover para
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUNAS.filter((c) => c.id !== processo.status).map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => onMove(processo.id, c.id)}>
                    {c.titulo}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(processo.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{processo.tipoAcao}</p>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{processo.vara}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Scale className="h-3 w-3 shrink-0" />
          <span className="truncate">vs. {processo.parteContraria}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">{processo.responsavel}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatarData(processo.prazo)}</span>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls.badge}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
          {rotuloPrazo(processo.prazo)}
        </span>
      </div>
    </div>
  );
}
