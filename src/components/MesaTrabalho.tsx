import { useMemo } from "react";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";
import { AssessorGroup } from "./AssessorGroup";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { ProcessoCard } from "./ProcessoCard";

interface Props {
  processos: Processo[];
  filtroTipo: "todos" | "DU" | "PA";
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onRedistribuir?: (processoId: string, novoResponsavel: string) => void;
}

export function MesaTrabalho({ processos, filtroTipo, onEdit, onDelete, onMove, onRedistribuir }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProcesso, setActiveProcesso] = useState<Processo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Precisa arrastar 8px para ativar (evita conflito com cliques)
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Encontra o processo sendo arrastado
    const processo = processos.find((p) => p.id === active.id);
    setActiveProcesso(processo || null);
    
    console.log("🖱️ Drag iniciado:", active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log("🖱️ Drag finalizado:", { activeId: active.id, overId: over?.id });
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      setActiveProcesso(null);
      return;
    }

    // O ID do 'over' é o responsável (nome do assessor ou "Aguardando Distribuição")
    const novoResponsavel = over.id as string;
    const processoId = active.id as string;
    
    console.log("📦 Redistribuindo processo:", processoId, "para:", novoResponsavel);
    
    // Chama callback de redistribuição
    if (onRedistribuir) {
      // Se for "Aguardando Distribuição", passa string vazia
      const responsavelFinal = novoResponsavel.includes("📥 Aguardando") ? "" : novoResponsavel;
      onRedistribuir(processoId, responsavelFinal);
    }
    
    setActiveId(null);
    setActiveProcesso(null);
  };

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
        // Processos sem responsável ou com "Sem responsável" vão para "Aguardando Distribuição"
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = "📥 Aguardando Distribuição";
        }
        if (!map.has(responsavelKey)) map.set(responsavelKey, []);
        map.get(responsavelKey)!.push(p);
      });
      
      console.log(`📊 Assessores encontrados para ${tipo}:`, Array.from(map.keys()));
      
      // Ordena: "Aguardando Distribuição" primeiro, depois ordem alfabética
      const assessores = Array.from(map.entries())
        .map(([nome, itens]) => ({ nome, itens }))
        .sort((a, b) => {
          if (a.nome.includes("📥 Aguardando")) return -1;
          if (b.nome.includes("📥 Aguardando")) return 1;
          return a.nome.localeCompare(b.nome);
        });
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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

      {/* Overlay que mostra o card sendo arrastado */}
      <DragOverlay>
        {activeProcesso ? (
          <div className="opacity-80 rotate-3 scale-105">
            <ProcessoCard
              p={activeProcesso}
              onEdit={() => {}}
              onDelete={() => {}}
              isDragging={true}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
