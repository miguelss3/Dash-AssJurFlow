import { ProcessoCard } from "./ProcessoCard";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";

interface Props {
  responsavel: string;
  tipo: TipoProcesso;
  processos: Processo[];
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
}

export function AssessorGroup({ responsavel, tipo, processos, onEdit, onDelete, onMove }: Props) {
  const isDU = tipo === "DU";
  const isAguardandoDistribuicao = responsavel.includes("📥 Aguardando");
  
  const tipoBg = isDU ? "bg-[var(--tipo-du-bg)]" : "bg-[var(--tipo-pa-bg)]";
  const tipoText = isDU ? "text-[var(--tipo-du)]" : "text-[var(--tipo-pa)]";
  const tipoBorder = isDU ? "border-[var(--tipo-du)]/30" : "border-[var(--tipo-pa)]/30";
  
  // Se é "Aguardando Distribuição", usa cor laranja destacada
  const bgClass = isAguardandoDistribuicao ? "bg-orange-50" : tipoBg;
  const textClass = isAguardandoDistribuicao ? "text-orange-700" : tipoText;
  const borderClass = isAguardandoDistribuicao ? "border-orange-300" : tipoBorder;

  return (
    <div className="shrink-0 w-[88vw] sm:w-[340px] snap-start flex flex-col rounded-3xl bg-card border border-border shadow-card overflow-hidden">
      {/* Header do assessor */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide border ${bgClass} ${textClass} ${borderClass}`}
        >
          {tipo} • {responsavel}
        </span>
        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-[11px] font-bold tabular-nums bg-muted text-foreground">
          {processos.length}
        </span>
      </div>

      {/* Lista */}
      <div className="flex-1 p-3 space-y-2.5 min-h-[140px] max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin">
        {processos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-xs text-muted-foreground/60 font-semibold">
            Sem processos no momento
          </div>
        ) : (
          processos.map((p) => (
            <ProcessoCard
              key={p.id}
              processo={p}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              showActions
            />
          ))
        )}
      </div>
    </div>
  );
}
