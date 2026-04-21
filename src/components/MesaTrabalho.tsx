import { useMemo } from "react";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";
import { AssessorGroup } from "./AssessorGroup";

interface Props {
  processos: Processo[];
  filtroTipo: "todos" | "DU" | "PA";
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
}

export function MesaTrabalho({ processos, filtroTipo, onEdit, onDelete, onMove }: Props) {
  const grupos = useMemo(() => {
    console.log("📊 MesaTrabalho - Total de processos recebidos:", processos.length);
    
    const ativos = processos.filter((p) => p.status !== "concluido");
    console.log("📊 Processos ativos (não concluídos):", ativos.length);
    
    const tipos: TipoProcesso[] =
      filtroTipo === "todos" ? ["DU", "PA"] : [filtroTipo as TipoProcesso];

    const result: { tipo: TipoProcesso; assessores: { nome: string; itens: Processo[] }[] }[] = [];

    for (const tipo of tipos) {
      // Usa 'setor' se existir (Firebase), senão 'tipo' (dados locais)
      const doTipo = ativos.filter((p) => (p.setor || p.tipo) === tipo);
      console.log(`📊 Processos do tipo ${tipo}:`, doTipo.length);
      
      const map = new Map<string, Processo[]>();
      doTipo.forEach((p) => {
        const r = p.responsavel || "Sem responsável";
        if (!map.has(r)) map.set(r, []);
        map.get(r)!.push(p);
      });
      
      console.log(`📊 Assessores encontrados para ${tipo}:`, Array.from(map.keys()));
      
      const assessores = Array.from(map.entries())
        .map(([nome, itens]) => ({ nome, itens }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      if (assessores.length > 0) {
        result.push({ tipo, assessores });
      }
    }
    
    console.log("📊 Resultado final:", result);
    return result;
  }, [processos, filtroTipo]);

  if (grupos.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-semibold text-muted-foreground">
          Nenhum processo ativo nesta visão.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grupos.map((grupo) => {
        const isDU = grupo.tipo === "DU";
        return (
          <section key={grupo.tipo}>
            <div className="mb-3">
              <span
                className={`inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider border ${
                  isDU
                    ? "bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border-[var(--tipo-du)]/30"
                    : "bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border-[var(--tipo-pa)]/30"
                }`}
              >
                Assessores {grupo.tipo}
              </span>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
              {grupo.assessores.map((a) => (
                <AssessorGroup
                  key={`${grupo.tipo}-${a.nome}`}
                  responsavel={a.nome}
                  tipo={grupo.tipo}
                  processos={a.itens}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={onMove}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
