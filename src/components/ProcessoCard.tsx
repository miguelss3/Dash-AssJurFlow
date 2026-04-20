import {
  Calendar,
  Building2,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowRight,
  GripVertical,
  Zap,
  AlertOctagon,
  Radio,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Processo, StatusProcesso } from "@/types/processo";
import { COLUNAS, TIPOS } from "@/types/processo";
import { classesPrazo, formatarDataCurta, rotuloPrazo, statusPrazo } from "@/lib/prazo";
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

function avatarBg(nome: string) {
  const palette = [
    "bg-gradient-to-br from-[oklch(0.6_0.16_230)] to-[oklch(0.45_0.16_250)]",
    "bg-gradient-to-br from-[oklch(0.62_0.22_305)] to-[oklch(0.5_0.2_290)]",
    "bg-gradient-to-br from-[oklch(0.6_0.15_155)] to-[oklch(0.5_0.13_170)]",
    "bg-gradient-to-br from-[oklch(0.7_0.17_50)] to-[oklch(0.6_0.18_35)]",
    "bg-gradient-to-br from-[oklch(0.58_0.22_25)] to-[oklch(0.5_0.2_15)]",
  ];
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function ProcessoCard({ processo, onEdit, onDelete, onMove, overlay = false }: Props) {
  const status = statusPrazo(processo.prazo);
  const cls = classesPrazo(status);
  const tipo = TIPOS.find((t) => t.id === processo.tipo) ?? TIPOS[0];
  const isLiminar = processo.prioridade === "liminar";

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
      className={`group relative rounded-2xl bg-card border border-border border-l-[3px] ${cls.border} p-3 shadow-card transition-[box-shadow,transform] ${
        overlay
          ? "shadow-card-hover rotate-2 cursor-grabbing scale-[1.02]"
          : isDragging
            ? "opacity-30"
            : "hover:shadow-card-hover hover:-translate-y-0.5 hover:border-accent/40 cursor-pointer"
      }`}
      onClick={overlay ? undefined : () => onEdit(processo)}
    >
      {/* Top: drag + tipo + prioridade + menu */}
      <div className="relative flex items-center gap-2 mb-2.5">
        {!overlay && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            aria-label="Arrastar processo"
            className="shrink-0 -ml-1 p-0.5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Tipo chip — DU azul, PA roxo */}
        {processo.tipo === "DU" ? (
          <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border border-[var(--tipo-du)]/30">
            DU
          </span>
        ) : processo.tipo === "PA" ? (
          <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border border-[var(--tipo-pa)]/30">
            PA
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide bg-muted text-muted-foreground border border-border">
            {tipo.label}
          </span>
        )}
        {/* Liminar */}
        {isLiminar && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--deadline-overdue)] bg-[var(--deadline-overdue-bg)] border border-[var(--deadline-overdue)]/40 animate-pulse-soft">
            <Zap className="h-2.5 w-2.5" />
            Liminar
          </span>
        )}
        {processo.prioridade === "urgente" && !isLiminar && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--deadline-today)] bg-[var(--deadline-today-bg)] border border-[var(--deadline-today)]/40">
            <AlertOctagon className="h-2.5 w-2.5" />
            Urgente
          </span>
        )}
        <div className="ml-auto" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-primary/10 hover:text-primary"
            >
              <MoreVertical className="h-3.5 w-3.5" />
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

      {/* Número */}
      <p className="relative text-[10px] text-muted-foreground truncate tracking-tight mb-1.5 font-mono">
        {processo.numero}
      </p>

      {/* Cliente / Assunto */}
      <h3 className="relative font-bold text-sm text-foreground leading-snug line-clamp-2 mb-1">
        {processo.tipoAcao || processo.cliente}
      </h3>
      <p className="relative text-[12px] text-muted-foreground line-clamp-1 mb-2.5">
        {processo.cliente}
      </p>

      {/* Prazos: interno + fatal */}
      <div className="relative grid grid-cols-2 gap-1.5 mb-2.5">
        <div className={`rounded-xl border px-2.5 py-1.5 ${cls.badge}`}>
          <p className="text-[9px] uppercase tracking-wider opacity-70 leading-none mb-1 font-semibold">
            Interno
          </p>
          <p className="text-[11px] font-bold leading-tight">
            {formatarDataCurta(processo.prazo)}
            <span className="ml-1 opacity-80">{rotuloPrazo(processo.prazo)}</span>
          </p>
        </div>
        {processo.prazoFatal ? (
          <div
            className={`rounded-xl border px-2.5 py-1.5 ${classesPrazo(statusPrazo(processo.prazoFatal)).badge}`}
          >
            <p className="text-[9px] uppercase tracking-wider opacity-70 leading-none mb-1 font-semibold">
              Fatal
            </p>
            <p className="text-[11px] font-bold leading-tight">
              {formatarDataCurta(processo.prazoFatal)}
              <span className="ml-1 opacity-80">{rotuloPrazo(processo.prazoFatal)}</span>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-2.5 py-1.5 text-[10px] text-muted-foreground/60 flex items-center justify-center">
            sem fatal
          </div>
        )}
      </div>

      {/* Meta tags: seção, origem, vara */}
      <div className="relative flex flex-wrap gap-1 mb-2.5 text-[10px]">
        {processo.secao && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-muted-foreground font-semibold">
            <Radio className="h-2.5 w-2.5 opacity-70" />
            {processo.secao}
          </span>
        )}
        {processo.origem && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-muted-foreground font-semibold">
            {processo.origem}
          </span>
        )}
        {processo.vara && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5 text-muted-foreground truncate max-w-full font-semibold">
            <Building2 className="h-2.5 w-2.5 opacity-70 shrink-0" />
            <span className="truncate">{processo.vara}</span>
          </span>
        )}
      </div>

      {/* Footer: avatar + status indicator */}
      <div className="relative flex items-center justify-between gap-2 pt-2.5 border-t border-border">
        <div className="flex items-center gap-2 min-w-0">
          {processo.responsavel && (
            <div
              className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${avatarBg(processo.responsavel)}`}
              title={processo.responsavel}
            >
              {iniciais(processo.responsavel)}
            </div>
          )}
          <span className="text-[11px] text-muted-foreground truncate font-medium">
            {processo.responsavel || "—"}
          </span>
        </div>
        <div
          className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-bold ${cls.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${cls.dot} ${status === "overdue" ? "animate-pulse-soft" : ""}`}
          />
          <Calendar className="h-2.5 w-2.5 opacity-60" />
          {rotuloPrazo(processo.prazo)}
        </div>
      </div>
    </div>
  );
}
