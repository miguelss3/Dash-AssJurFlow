import { useMemo, useEffect, useState } from "react";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";
import { AssessorGroup } from "./AssessorGroup";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { ProcessoCard } from "./ProcessoCard";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuthUser } from "@/hooks/useAuth";

interface Props {
  processos: Processo[];
  filtroTipo: "todos" | "DU" | "PA";
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onClone?: (id: string) => void;
  onRedistribuir?: (processoId: string, novoResponsavel: string) => void | Promise<void>;
  usuario?: AuthUser;
  ehAdmin?: boolean;
}

export function MesaTrabalho({ processos, filtroTipo, onEdit, onDelete, onMove, onClone, onRedistribuir, usuario, ehAdmin }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProcesso, setActiveProcesso] = useState<Processo | null>(null);
  const [assessoresDoSetor, setAssessoresDoSetor] = useState<{ nome: string; setor: string }[]>([]);
  const [responsaveisOtimizados, setResponsaveisOtimizados] = useState<Record<string, string>>({});

  const processosEfetivos = useMemo(() => {
    return processos.map((p) => {
      if (!(p.id in responsaveisOtimizados)) return p;
      return { ...p, responsavel: responsaveisOtimizados[p.id] };
    });
  }, [processos, responsaveisOtimizados]);

  // Remove a otimização quando o snapshot real do Firestore já refletiu a mudança
  useEffect(() => {
    if (Object.keys(responsaveisOtimizados).length === 0) return;

    setResponsaveisOtimizados((prev) => {
      let mudou = false;
      const next = { ...prev };

      for (const [processoId, responsavelEsperado] of Object.entries(prev)) {
        const processoReal = processos.find((p) => p.id === processoId);
        if (!processoReal) {
          delete next[processoId];
          mudou = true;
          continue;
        }

        const responsavelReal = (processoReal.responsavel || "").trim();
        if (responsavelReal === (responsavelEsperado || "").trim()) {
          delete next[processoId];
          mudou = true;
        }
      }

      return mudou ? next : prev;
    });
  }, [processos, responsaveisOtimizados]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Precisa arrastar 8px para ativar (evita conflito com cliques)
      },
    })
  );

  // Busca todos os assessores do setor (DU ou PA)
  useEffect(() => {
    const buscarAssessores = async () => {
      if (!usuario) return;
      
      // Admin busca de ambos os setores; assessor busca apenas do seu setor
      const setoresParaBuscar: string[] = ehAdmin ? ["DU", "PA"] : [usuario.setor || ""].filter(Boolean);
      if (setoresParaBuscar.length === 0) return;
      
      try {
        const usuariosRef = collection(db, "usuarios");
        const todosDocs: { nome: string; setor: string }[] = [];
        
        for (const setorParaBuscar of setoresParaBuscar) {
          const q = query(usuariosRef, where("setor", "==", setorParaBuscar));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            const nomeExibicao = data.nomeGuerra || data.nome || data.email?.split("@")[0] || "Assessor";
            const nomeCompleto = data.posto ? `${data.posto} ${nomeExibicao}`.trim() : nomeExibicao;
            todosDocs.push({ nome: nomeCompleto, setor: data.setor || setorParaBuscar });
          });
        }
        
        setAssessoresDoSetor(todosDocs);
      } catch (error) {
        console.error("❌ Erro ao buscar assessores:", error);
      }
    };
    
    buscarAssessores();
  }, [usuario, ehAdmin]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    // Encontra o processo sendo arrastado
    const processo = processosEfetivos.find((p) => p.id === active.id);
    setActiveProcesso(processo || null);
    
    // console.log("🖱️ Drag iniciado:", active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    // console.log("🖱️ Drag finalizado:", { activeId: active.id, overId: over?.id });
    
    if (!over || active.id === over.id) {
      setActiveId(null);
      setActiveProcesso(null);
      return;
    }

    // O ID do 'over' é o responsável (nome do assessor ou "Aguardando Distribuição")
    const novoResponsavel = over.id as string;
    if (novoResponsavel === "MESA DO CHEFE") {
      setActiveId(null);
      setActiveProcesso(null);
      return;
    }
    const processoId = active.id as string;
    const processoAtual = processosEfetivos.find((p) => p.id === processoId);
    const responsavelAnterior = processoAtual?.responsavel || "";
    
    // console.log("📦 Redistribuindo processo:", processoId, "para:", novoResponsavel);
    
    // Chama callback de redistribuição
    if (onRedistribuir) {
      // Se for "Aguardando Distribuição", passa string vazia
      const responsavelFinal = novoResponsavel.includes("📥 Aguardando") ? "" : novoResponsavel;

      // Atualização otimista: move o card imediatamente na UI
      setResponsaveisOtimizados((prev) => ({
        ...prev,
        [processoId]: responsavelFinal,
      }));

      Promise.resolve(onRedistribuir(processoId, responsavelFinal)).catch(() => {
        // Reverte visualmente em caso de erro de persistência
        setResponsaveisOtimizados((prev) => ({
          ...prev,
          [processoId]: responsavelAnterior,
        }));
      });
    }
    
    setActiveId(null);
    setActiveProcesso(null);
  };

  const grupos = useMemo(() => {
    // console.log("📊 MesaTrabalho - Total de processos recebidos:", processos.length);
    // console.log("📊 Assessores do setor carregados:", assessoresDoSetor.length);
    
    const ativos = processosEfetivos.filter((p) => p.status !== "concluido");
    // console.log("📊 Processos ativos (não concluídos):", ativos.length);
    
    const tipos: TipoProcesso[] =
      filtroTipo === "todos" ? ["DU", "PA"] : [filtroTipo as TipoProcesso];

    const result: {
      tipo: TipoProcesso;
      assessores: { nome: string; itensAtivos: Processo[]; itensConcluidos: Processo[] }[];
    }[] = [];

    for (const tipo of tipos) {
      // Usa 'setor' se existir (Firebase), senão 'tipo' (dados locais)
      const doTipo = ativos.filter((p) => (p.setor || p.tipo) === tipo);
      const concluidosDoTipo = processosEfetivos.filter(
        (p) => (p.setor || p.tipo) === tipo && p.status === "concluido",
      );
      // console.log(`📊 Processos do tipo ${tipo}:`, doTipo.length);

      const isPendenteChefia = (p: Processo) => {
        const situacaoFluxo = p.pedidoSubsidios?.situacaoFluxo || "";
        const statusNorm = (p.status || "").toString().toLowerCase();
        return ["aguardando_assinatura_secao", "aguardando_aprovacao_externa", "enviado_admin"].includes(situacaoFluxo)
          || statusNorm.includes("aguardando assinatura")
          || statusNorm.includes("aguardando chem");
      };

      const pendenciasChefia = ehAdmin ? doTipo.filter(isPendenteChefia) : [];
      const doTipoSemPendenciasChefia = ehAdmin ? doTipo.filter((p) => !isPendenteChefia(p)) : doTipo;
      
      const mapAtivos = new Map<string, Processo[]>();
      const mapConcluidos = new Map<string, Processo[]>();

      if (ehAdmin && pendenciasChefia.length > 0) {
        mapAtivos.set("MESA DO CHEFE", pendenciasChefia);
      }
      
      // Adiciona os processos aos seus responsáveis
      doTipoSemPendenciasChefia.forEach((p) => {
        // Processos sem responsável ou com "Sem responsável" vão para "Aguardando Distribuição"
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = "📥 Aguardando Distribuição";
        }
        if (!mapAtivos.has(responsavelKey)) mapAtivos.set(responsavelKey, []);
        mapAtivos.get(responsavelKey)!.push(p);
      });

      concluidosDoTipo.forEach((p) => {
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = "📥 Aguardando Distribuição";
        }
        if (!mapConcluidos.has(responsavelKey)) mapConcluidos.set(responsavelKey, []);
        mapConcluidos.get(responsavelKey)!.push(p);
      });
      
      // Adiciona todos os assessores do setor (mesmo sem processos)
      const assessoresDesteTipo = assessoresDoSetor.filter(a => a.setor === tipo);
      assessoresDesteTipo.forEach(assessor => {
        if (!mapAtivos.has(assessor.nome)) {
          mapAtivos.set(assessor.nome, []); // Coluna vazia
        }
        if (!mapConcluidos.has(assessor.nome)) {
          mapConcluidos.set(assessor.nome, []);
        }
      });
      
      // console.log(`📊 Assessores com colunas para ${tipo}:`, Array.from(map.keys()));
      
      // Ordena: "Aguardando Distribuição" primeiro (SE houver processos), depois ordem alfabética
      const nomesAssessores = Array.from(new Set([...mapAtivos.keys(), ...mapConcluidos.keys()]));

      const assessores = nomesAssessores
        .map((nome) => ({
          nome,
          itensAtivos: mapAtivos.get(nome) || [],
          itensConcluidos: mapConcluidos.get(nome) || [],
        }))
        .filter(({ nome, itensAtivos, itensConcluidos }) => {
          // Só mostra "Aguardando Distribuição" se tiver processos
          if (nome.includes("📥 Aguardando")) {
            return itensAtivos.length > 0 || itensConcluidos.length > 0;
          }
          return true; // Outros assessores sempre aparecem
        })
        .sort((a, b) => {
          if (a.nome.includes("MESA DO CHEFE")) return -1;
          if (b.nome.includes("MESA DO CHEFE")) return 1;
          if (a.nome.includes("📥 Aguardando")) return -1;
          if (b.nome.includes("📥 Aguardando")) return 1;
          return a.nome.localeCompare(b.nome);
        });
      if (assessores.length > 0) {
        result.push({ tipo, assessores });
      }
    }
    
    // console.log("📊 Resultado final:", result);
    return result;
  }, [processosEfetivos, filtroTipo, assessoresDoSetor]);

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
      collisionDetection={(args) => {
          // Prefere pointerWithin (ponteiro dentro da área); fallback para closestCenter
          const within = pointerWithin(args);
          return within.length > 0 ? within : closestCenter(args);
        }}
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
                    processos={a.itensAtivos}
                    processosConcluidos={a.itensConcluidos}
                    ehAdmin={ehAdmin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMove={onMove}
                    onClone={onClone}
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
              ehAdmin={ehAdmin}
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
