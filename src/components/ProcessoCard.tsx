import { Calendar, Building2, Scale, MoreVertical, Pencil, Trash2, ArrowRight, GripVertical } from "lucide-react";
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
  overlay?: boolean;
}

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

// Cores determinísticas para avatar (a partir do nome)
function avatarBg(nome: string) {
  const palette = [
    "bg-gradient-to-br from-[oklch(0.55_0.18_265)] to-[oklch(0.45_0.14_270)]",
    "bg-gradient-to-br from-[oklch(0.65_0.15_200)] to-[oklch(0.5_0.13_220)]",
    "bg-gradient-to-br from-[oklch(0.6_0.18_25)] to-[oklch(0.5_0.16_15)]",
    "bg-gradient-to-br from-[oklch(0.65_0.15_160)] to-[oklch(0.5_0.13_170)]",
    "bg-gradient-to-br from-[oklch(0.78_0.13_80)] to-[oklch(0.65_0.15_70)]",
  ];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
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
      className={`group relative rounded-xl bg-card border border-border border-l-[3px] ${cls.border} p-3.5 shadow-[var(--shadow-card)] transition-[box-shadow,transform] ${
        overlay
          ? "shadow-[var(--shadow-card-hover)] rotate-2 cursor-grabbing scale-[1.02]"
          : isDragging
            ? "opacity-30"
            : "hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 cursor-pointer"
      }`}
      onClick={overlay ? undefined : () => onEdit(processo)}
    >
      {/* Top: handle + número + menu */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {!overlay && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              aria-label="Arrastar processo"
              className="shrink-0 -ml-1 p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          <p className="text-[10px] font-mono font-medium text-muted-foreground/80 truncate tracking-tight">
            {processo.numero}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -mr-1 -mt-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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

      {/* Cliente */}
      <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2 mb-1">
        {processo.cliente}
      </h3>
      <p className="text-xs text-muted-foreground line-clamp-1 mb-3">{processo.tipoAcao}</p>

      {/* Meta */}
      <div className="space-y-1 text-[11px] text-muted-foreground mb-3">
        {processo.vara && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">{processo.vara}</span>
          </div>
        )}
        {processo.parteContraria && (
          <div className="flex items-center gap-1.5">
            <Scale className="h-3 w-3 shrink-0 opacity-70" />
            <span className="truncate">vs. {processo.parteContraria}</span>
          </div>
        )}
      </div>

      {/* Footer: avatar responsável + prazo */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/70">
        <div className="flex items-center gap-2 min-w-0">
          {processo.responsavel && (
            <div
              className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-card ${avatarBg(processo.responsavel)}`}
              title={processo.responsavel}
            >
              {iniciais(processo.responsavel)}
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground min-w-0">
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatarData(processo.prazo)}</span>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls.badge} ${status === "overdue" ? "animate-pulse-soft" : ""}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${cls.dot}`} />
          {rotuloPrazo(processo.prazo)}
        </span>
      </div>
    </div>
  );
}
