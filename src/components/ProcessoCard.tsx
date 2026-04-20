import {
  MoreVertical,
  Pencil,
  Trash2,
  ArrowRight,
  GripVertical,
  Zap,
  AlertOctagon,
  Undo2,
  MessageCircle,
  CheckSquare,
  Play,
  Hourglass,
} from "lucide-react";
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
  showActions?: boolean;
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

function diasParaTexto(prazoISO?: string): string | null {
  if (!prazoISO) return null;
  const ms = new Date(prazoISO).getTime() - Date.now();
  const d = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (d < 0) return `${Math.abs(d)}d atrasado`;
  return `${d}d`;
}

export function ProcessoCard({
  processo,
  onEdit,
  onDelete,
  onMove,
  overlay = false,
  showActions = false,
}: Props) {
  const status = statusPrazo(processo.prazo);
  const cls = classesPrazo(status);
  const isLiminar = processo.prioridade === "liminar";
  const isPA = processo.tipo === "PA";

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

  // Card destaque (liminar = borda vermelha tipo alerta)
  const cardHighlight = isLiminar
    ? "border-[var(--deadline-overdue)]/60 bg-[var(--deadline-overdue-bg)]/30 shadow-[0_0_0_3px_var(--deadline-overdue-bg)]"
    : processo.faseAtual === "Em diligência"
      ? "border-[var(--deadline-soon)]/50 bg-[var(--deadline-soon-bg)]/20"
      : "border-border bg-card";

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`group relative rounded-2xl border ${cardHighlight} p-3.5 shadow-card transition-[box-shadow,transform] ${
        overlay
          ? "shadow-card-hover rotate-2 cursor-grabbing scale-[1.02]"
          : isDragging
            ? "opacity-30"
            : "hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer"
      }`}
      onClick={overlay ? undefined : () => onEdit(processo)}
    >
      {/* Top: drag + tipo + número + sub-chips + menu */}
      <div className="relative flex items-center gap-1.5 mb-2 flex-wrap">
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
        {/* Tipo chip */}
        {processo.tipo === "DU" ? (
          <span className="shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border border-[var(--tipo-du)]/30">
            DU
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border border-[var(--tipo-pa)]/30">
            PA
          </span>
        )}
        {/* Número monoespaçado */}
        <span className="text-[10px] font-mono text-foreground/80 truncate max-w-[180px]">
          {processo.numero}
        </span>
        {/* Subtipo PA */}
        {isPA && processo.subtipo && (
          <span className="shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--tipo-pa-bg)]/60 text-[var(--tipo-pa)] border border-[var(--tipo-pa)]/20">
            {processo.subtipo}
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
        {processo.prioridade === "normal" && (
          <span className="shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
            Normal
          </span>
        )}
        {/* Contador de dias para PA */}
        {isPA && processo.finalPrazo && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold bg-[var(--deadline-soon-bg)] text-[var(--deadline-soon)] border border-[var(--deadline-soon)]/30">
            <Hourglass className="h-2.5 w-2.5" />
            {diasParaTexto(processo.finalPrazo)}
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

      {/* Fase atual (PA) */}
      {isPA && processo.faseAtual && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
              processo.faseAtual === "Atrasado"
                ? "bg-[var(--deadline-overdue-bg)] text-[var(--deadline-overdue)] border-[var(--deadline-overdue)]/40"
                : processo.faseAtual === "Em diligência"
                  ? "bg-[var(--deadline-soon-bg)] text-[var(--deadline-soon)] border-[var(--deadline-soon)]/40"
                  : "bg-[var(--deadline-safe-bg)] text-[var(--deadline-safe)] border-[var(--deadline-safe)]/40"
            }`}
          >
            <Play className="h-2.5 w-2.5" />
            {processo.faseAtual}
          </span>
        </div>
      )}

      {/* Assunto principal */}
      <h3 className="relative font-bold text-[13px] text-foreground leading-snug line-clamp-3 mb-2">
        {processo.tipoAcao || processo.cliente}
      </h3>

      {/* Resposta assinada chip (DU) */}
      {processo.faseAtual === "Resposta assinada" && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold bg-[var(--deadline-safe-bg)] text-[var(--deadline-safe)] border border-[var(--deadline-safe)]/40">
            <CheckSquare className="h-2.5 w-2.5" />
            Resposta assinada pelo CHEM em {formatarData(processo.prazo)} • DIEx 654
          </span>
        </div>
      )}

      {/* Início + Final (PA com diligência) */}
      {isPA && processo.inicioPrazo && processo.finalPrazo && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold bg-[var(--deadline-soon-bg)] text-[var(--deadline-soon)] border border-[var(--deadline-soon)]/30">
            Início: {formatarData(processo.inicioPrazo)} • Final: {formatarData(processo.finalPrazo)}
          </span>
        </div>
      )}

      {/* Prazos: interno + fatal (DU) */}
      {!isPA && (
        <div className="relative grid grid-cols-2 gap-1.5 mb-2.5">
          <div className={`rounded-lg border px-2 py-1 ${cls.badge}`}>
            <p className="text-[9px] uppercase tracking-wider opacity-70 leading-none mb-0.5 font-semibold">
              Interno
            </p>
            <p className="text-[11px] font-bold leading-tight">
              {formatarData(processo.prazo)}
            </p>
          </div>
          {processo.prazoFatal && (
            <div
              className={`rounded-lg border px-2 py-1 ${classesPrazo(statusPrazo(processo.prazoFatal)).badge}`}
            >
              <p className="text-[9px] uppercase tracking-wider opacity-70 leading-none mb-0.5 font-semibold">
                Fatal
              </p>
              <p className="text-[11px] font-bold leading-tight">
                {formatarData(processo.prazoFatal)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Meta info textual estilo AssJur (Parte / Entrada / Seção / Origem) */}
      <div className="text-[10.5px] text-foreground/80 space-y-0.5 mb-2.5">
        {processo.cliente && processo.cliente !== "—" && (
          <p className="truncate">
            <span className="text-muted-foreground">Parte:</span>{" "}
            <span className="font-semibold">{processo.cliente}</span>
          </p>
        )}
        {processo.entrada && (
          <p>
            <span className="text-muted-foreground">Entrada:</span>{" "}
            <span className="font-semibold">{formatarData(processo.entrada)}</span>
          </p>
        )}
        <div className="flex flex-wrap gap-x-3">
          {processo.secao && (
            <p>
              <span className="text-muted-foreground">Seção:</span>{" "}
              <span className="font-semibold">{processo.secao}</span>
            </p>
          )}
          {processo.origem && (
            <p>
              <span className="text-muted-foreground">Origem:</span>{" "}
              <span className="font-semibold">{processo.origem}</span>
            </p>
          )}
        </div>
      </div>

      {/* Responsável (encarregado) */}
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${avatarBg(processo.responsavel)}`}
          title={processo.responsavel}
        >
          {iniciais(processo.responsavel)}
        </div>
        <span className="text-[11px] text-foreground font-semibold truncate">
          {processo.responsavel || "—"}
        </span>
      </div>

      {/* === BOTÕES DE AÇÃO (estilo AssJur) === */}
      {showActions && !overlay && (
        <div
          className="grid grid-cols-2 gap-1.5 mb-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ActionBtn tone="blue" label="Ação" />
          <ActionBtn tone="muted" label="Desfazer Última Ação" icon={Undo2} />
          <ActionBtn
            tone="amber"
            label="Editar"
            icon={Pencil}
            onClick={() => onEdit(processo)}
          />
          <ActionBtn tone="cyan" label="Chat" icon={MessageCircle} />
          <ActionBtn tone="green" label="Finalizar" icon={CheckSquare} />
          <ActionBtn
            tone="red"
            label="Excluir"
            icon={Trash2}
            onClick={() => onDelete(processo.id)}
          />
        </div>
      )}

      {/* Último movimento */}
      {processo.descricao && (
        <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 mt-1">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold leading-none mb-1">
            Último movimento
          </p>
          <p className="text-[11px] text-foreground leading-snug line-clamp-2">
            {processo.descricao}
          </p>
        </div>
      )}

      {/* Footer status indicator (apenas DU) */}
      {!isPA && (
        <div
          className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold ${cls.text}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${cls.dot} ${status === "overdue" ? "animate-pulse-soft" : ""}`}
          />
          {rotuloPrazo(processo.prazo)}
        </div>
      )}
    </div>
  );
}

/* === Botão de ação estilizado === */
function ActionBtn({
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  icon?: typeof Pencil;
  tone: "blue" | "muted" | "amber" | "cyan" | "green" | "red";
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    blue: "border-[var(--tipo-du)]/40 text-[var(--tipo-du)] bg-card hover:bg-[var(--tipo-du-bg)]",
    muted: "border-border text-foreground/70 bg-card hover:bg-muted",
    amber: "border-[var(--deadline-soon)]/40 text-[var(--deadline-soon)] bg-card hover:bg-[var(--deadline-soon-bg)]",
    cyan: "border-[oklch(0.7_0.13_200)]/40 text-[oklch(0.55_0.13_220)] bg-card hover:bg-[oklch(0.7_0.13_200_/_0.1)]",
    green: "border-[var(--deadline-safe)]/40 text-[var(--deadline-safe)] bg-card hover:bg-[var(--deadline-safe-bg)]",
    red: "border-[var(--deadline-overdue)]/40 text-[var(--deadline-overdue)] bg-card hover:bg-[var(--deadline-overdue-bg)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 h-8 rounded-lg border text-[11px] font-semibold transition-colors ${tones[tone]}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );
}
