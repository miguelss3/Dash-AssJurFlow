import { ProcessoCard } from "./ProcessoCard";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";
import { useDroppable } from "@dnd-kit/core";
import { useState } from "react";

interface Props {
  responsavel: string;
  tipo: TipoProcesso;
  processos: Processo[];
  processosConcluidos?: Processo[];
  ehAdmin?: boolean;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onClone?: (id: string) => void;
}

export function AssessorGroup({ responsavel, tipo, processos, processosConcluidos = [], ehAdmin, onEdit, onDelete, onMove, onClone }: Props) {
  const [aba, setAba] = useState<"ativos" | "concluidos">("ativos");
  const { setNodeRef, isOver } = useDroppable({
    id: responsavel, // ID único para esta coluna (nome do assessor)
  });

  const isDU = tipo === "DU";
  const isAguardandoDistribuicao = responsavel.includes("📥 Aguardando");
  
  const tipoBg = isDU ? "bg-[var(--tipo-du-bg)]" : "bg-[var(--tipo-pa-bg)]";
  const tipoText = isDU ? "text-[var(--tipo-du)]" : "text-[var(--tipo-pa)]";
  const tipoBorder = isDU ? "border-[var(--tipo-du)]/30" : "border-[var(--tipo-pa)]/30";
  
  // Se é "Aguardando Distribuição", usa cor laranja destacada
  const bgClass = isAguardandoDistribuicao ? "bg-orange-50" : tipoBg;
  const textClass = isAguardandoDistribuicao ? "text-orange-700" : tipoText;
  const borderClass = isAguardandoDistribuicao ? "border-orange-300" : tipoBorder;
  const processosDaAba = aba === "ativos" ? processos : processosConcluidos;

  return (
    <div 
      ref={setNodeRef}
      className={`shrink-0 w-[88vw] sm:w-[340px] snap-start flex flex-col rounded-3xl bg-card border shadow-card overflow-hidden transition-all ${
        isOver ? "border-blue-500 border-2 ring-2 ring-blue-200 scale-[1.02]" : "border-border"
      }`}
    >
      {/* Header do assessor */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide border ${bgClass} ${textClass} ${borderClass}`}
        >
          {tipo} • {responsavel}
        </span>
        <div className="inline-flex items-center rounded-full bg-muted p-1 gap-1">
          <button
            type="button"
            onClick={() => setAba("ativos")}
            className={`h-6 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
              aba === "ativos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Ativos ({processos.length})
          </button>
          <button
            type="button"
            onClick={() => setAba("concluidos")}
            className={`h-6 px-2 rounded-full text-[10px] font-bold uppercase tracking-wide transition-colors ${
              aba === "concluidos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Concluídos ({processosConcluidos.length})
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 p-3 space-y-2.5 min-h-[140px] max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin">
        {processosDaAba.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-xs text-muted-foreground/60 font-semibold">
            {aba === "ativos" ? "Sem processos ativos" : "Sem processos concluídos"}
          </div>
        ) : (
          processosDaAba.map((p) => (
            <ProcessoCard
              key={p.id}
              processo={p}
              ehAdmin={ehAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onClone={onClone}
              showActions
            />
          ))
        )}
      </div>
    </div>
  );
}
