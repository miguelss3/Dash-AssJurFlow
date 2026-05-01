import { CardDU } from "./CardDU";
import { CardPA } from "./CardPA";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";
import { useDroppable } from "@dnd-kit/core";

interface Props {
  responsavel: string;
  tipo: TipoProcesso;
  processos: Processo[];
  ehAdmin?: boolean;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  siteSettings?: SiteSettings;
  unreadProcessIds?: Set<string>;
  onReadProcess?: (processoId: string) => void;
  mapaCoresAssessores?: Record<string, string>;
}

export function ChefeGroup({
  responsavel,
  tipo,
  processos,
  ehAdmin,
  onEdit,
  onDelete,
  onMove,
  onReativarProcesso,
  siteSettings,
  unreadProcessIds,
  onReadProcess,
  mapaCoresAssessores = {},
}: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: responsavel,
  });

  const isDU = tipo === "DU";
  const CardComponente = isDU ? CardDU : CardPA;
  const bgClass = isDU ? "bg-[var(--tipo-du-bg)]" : "bg-[var(--tipo-pa-bg)]";
  const textClass = isDU ? "text-[var(--tipo-du)]" : "text-[var(--tipo-pa)]";
  const borderClass = isDU ? "border-[var(--tipo-du)]/30" : "border-[var(--tipo-pa)]/30";

  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 w-[88vw] sm:w-[340px] snap-start flex flex-col rounded-3xl bg-card border shadow-card overflow-hidden transition-all ${
        isOver ? "border-amber-500 border-2 ring-2 ring-amber-200 scale-[1.02]" : "border-border"
      }`}
    >
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold tracking-wide border ${bgClass} ${textClass} ${borderClass}`}
          >
            {tipo} · {responsavel}
          </span>
        </div>
        <div className="rounded-xl bg-muted p-1 gap-1 grid grid-cols-1">
          <button
            type="button"
            className="min-h-[52px] px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors leading-tight bg-background text-foreground shadow-sm"
          >
            <span className="block">Entrada</span>
            <span className="block mt-1 text-[11px]">({processos.length})</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 space-y-2.5 min-h-[140px] max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin">
        {processos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-xs text-muted-foreground/60 font-semibold">
            Sem processos na mesa
          </div>
        ) : (
          processos.map((p) => (
            <CardComponente
              key={p.id}
              processo={p}
              ehAdmin={ehAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onReativarProcesso={onReativarProcesso}
              siteSettings={siteSettings}
              showActions
              naoLido={!!unreadProcessIds?.has(p.id)}
              onMarcarComoLido={onReadProcess}
              corDestaque={mapaCoresAssessores[(p.responsavel || "").trim()]}
            />
          ))
        )}
      </div>
    </div>
  );
}
