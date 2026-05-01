import { useMemo, useState } from "react";
import type { Processo, StatusProcesso, TipoProcesso } from "@/types/processo";
import { AssessorGroup } from "./AssessorGroup";
import { ChefeGroup } from "./ChefeGroup";
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
import { CardPA } from "./CardPA";
import type { SiteSettings } from "@/types/siteSettings";
import { DEFAULT_PA_EM_ANDAMENTO_COLUMNS } from "@/types/siteSettings";
import { diasRestantes } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  assessores: { nome: string; setor: string; corCard?: string }[];
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  onRedistribuir?: (
    processoId: string,
    novoResponsavel: string,
    opcoes?: { situacaoFluxo?: string; mensagemHistorico?: string },
  ) => void | Promise<void>;
  ehAdmin?: boolean;
  unreadProcessIds?: Set<string>;
  onReadProcess?: (processoId: string) => void;
  siteSettings?: SiteSettings;
  busca?: string;
}

export function MesaPA({
  processos,
  assessores,
  onEdit,
  onDelete,
  onMove,
  onReativarProcesso,
  onRedistribuir,
  ehAdmin,
  unreadProcessIds,
  onReadProcess,
  siteSettings,
  busca,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProcesso, setActiveProcesso] = useState<Processo | null>(null);
  const [responsaveisOtimizados, setResponsaveisOtimizados] = useState<Record<string, string>>({});

  const mapaCoresAssessores = useMemo(() => {
    const mapa: Record<string, string> = {};
    assessores.forEach((assessor) => {
      const nome = String(assessor.nome || "").trim();
      const cor = String(assessor.corCard || "").trim();
      if (!nome || !cor) return;
      mapa[nome] = cor;
    });
    return mapa;
  }, [assessores]);

  const paColunasEmAndamento = useMemo(() => {
    const base = siteSettings?.paEmAndamentoColumns?.length
      ? siteSettings.paEmAndamentoColumns
      : DEFAULT_PA_EM_ANDAMENTO_COLUMNS;

    const habilitadas = [...base]
      .filter((coluna) => coluna.enabled !== false)
      .sort((a, b) => a.order - b.order)
      .map((coluna) => ({
        ...coluna,
        label: String(coluna.label || "").trim() || coluna.id,
      }));

    return habilitadas.length > 0
      ? habilitadas
      : [...DEFAULT_PA_EM_ANDAMENTO_COLUMNS].sort((a, b) => a.order - b.order);
  }, [siteSettings?.paEmAndamentoColumns]);

  const paColunaLabelPorId = useMemo(
    () => new Map(paColunasEmAndamento.map((coluna) => [coluna.id, coluna.label])),
    [paColunasEmAndamento],
  );

  const paColunaLabels = useMemo(
    () => paColunasEmAndamento.map((coluna) => coluna.label),
    [paColunasEmAndamento],
  );

  const paColunaLabelSet = useMemo(
    () => new Set(paColunaLabels),
    [paColunaLabels],
  );

  const processosEfetivos = useMemo(() => {
    return processos.map((p) => {
      if (!(p.id in responsaveisOtimizados)) return p;
      return { ...p, responsavel: responsaveisOtimizados[p.id] };
    });
  }, [processos, responsaveisOtimizados]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const processo = processosEfetivos.find((p) => p.id === active.id);
    setActiveProcesso(processo || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      setActiveProcesso(null);
      return;
    }

    const novoResponsavel = over.id as string;

    // PA não tem retrocesso de fluxo como DU; todas as drops são redistribuições diretas
    if (paColunaLabelSet.has(novoResponsavel)) {
      setActiveId(null);
      setActiveProcesso(null);
      return;
    }

    const processoId = active.id as string;
    const processoAtual = processosEfetivos.find((p) => p.id === processoId);
    const responsavelAnterior = processoAtual?.responsavel || "";

    if (onRedistribuir) {
      const responsavelFinal = novoResponsavel === "" ? "" : novoResponsavel;

      setResponsaveisOtimizados((prev) => ({
        ...prev,
        [processoId]: responsavelFinal,
      }));

      Promise.resolve(onRedistribuir(processoId, responsavelFinal)).catch(() => {
        setResponsaveisOtimizados((prev) => ({
          ...prev,
          [processoId]: responsavelAnterior,
        }));
      });
    }

    setActiveId(null);
    setActiveProcesso(null);
  };

  const classificarPA = (p: Processo, tipoNorm: string): { emAndamento: string | null; portaria: string | null; atrasado: boolean } => {
    const situacaoFluxo = (p.situacaoFluxo || "").toString().trim();
    const emCurso = situacaoFluxo === "EM_CURSO" || situacaoFluxo === "C_EM_CURSO";
    let emAndamento: string | null = null;
    if (emCurso) {
      if (tipoNorm.includes("conselho")) emAndamento = paColunaLabelPorId.get("conselho") || null;
      else if (tipoNorm.includes("ipm")) emAndamento = paColunaLabelPorId.get("ipm") || null;
      else if (tipoNorm.includes("sindic")) emAndamento = paColunaLabelPorId.get("sindicancia") || null;
    }

    let portaria: string | null = null;
    if (situacaoFluxo === "AGUARDANDO_PRAZO" && tipoNorm.includes("sindic")) {
      portaria = paColunaLabelPorId.get("sindicancia") || null;
    }

    let atrasado = false;
    if (emCurso) {
      const prazoBase = p.prazoFatal || p.finalPrazo;
      atrasado = !!prazoBase && diasRestantes(prazoBase) < 0;
    }
    return { emAndamento, portaria, atrasado };
  };

  const grupos = useMemo(() => {
    const ativos = processosEfetivos.filter((p) => p.status !== "concluido");
    const concluidosDoTipo = processosEfetivos.filter((p) => p.status === "concluido");

    const colunaPAEmAndamentoPorId = new Map<string, string | null>();
    const colunaPAPortariaAssinadaPorId = new Map<string, string | null>();
    const isPAAtrasadoPorId = new Map<string, boolean>();

    for (const p of processosEfetivos) {
      const tipoPANorm = (p.tipoPA || p.subtipo || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      const { emAndamento, portaria, atrasado } = classificarPA(p, tipoPANorm);
      colunaPAEmAndamentoPorId.set(p.id, emAndamento);
      colunaPAPortariaAssinadaPorId.set(p.id, portaria);
      isPAAtrasadoPorId.set(p.id, atrasado);
    }

    const mapAtivos = new Map<string, Processo[]>();
    const mapPortariaAssinada = new Map<string, Processo[]>();
    const mapAtrasados = new Map<string, Processo[]>();
    const mapConcluidos = new Map<string, Processo[]>();

    const garantirChave = (chave: string) => {
      if (!mapAtivos.has(chave)) mapAtivos.set(chave, []);
      if (!mapPortariaAssinada.has(chave)) mapPortariaAssinada.set(chave, []);
      if (!mapAtrasados.has(chave)) mapAtrasados.set(chave, []);
      if (!mapConcluidos.has(chave)) mapConcluidos.set(chave, []);
    };

    paColunaLabels.forEach(garantirChave);
    garantirChave("MESA DO CHEFE");
    assessores.forEach((assessor) => {
      const nomeAssessor = String(assessor.nome || "").trim();
      if (nomeAssessor) garantirChave(nomeAssessor);
    });

    ativos.forEach((p) => {
      const colunaPortariaAssinadaPA = colunaPAPortariaAssinadaPorId.get(p.id) || null;
      if (colunaPortariaAssinadaPA) {
        mapPortariaAssinada.get(colunaPortariaAssinadaPA)!.push(p);
        return;
      }

      const colunaEspecialPA = colunaPAEmAndamentoPorId.get(p.id) || null;
      if (colunaEspecialPA) {
        if (isPAAtrasadoPorId.get(p.id)) {
          mapAtrasados.get(colunaEspecialPA)!.push(p);
        } else {
          mapAtivos.get(colunaEspecialPA)!.push(p);
        }
        return;
      }

      const responsavelNormalizado = String(p.responsavel || "").trim() || "MESA DO CHEFE";
      garantirChave(responsavelNormalizado);
      mapAtivos.get(responsavelNormalizado)!.push(p);
    });

    concluidosDoTipo.forEach((p) => {
      const colunaEspecialPA = colunaPAEmAndamentoPorId.get(p.id) || null;
      if (colunaEspecialPA) {
        garantirChave(colunaEspecialPA);
        mapConcluidos.get(colunaEspecialPA)!.push(p);
        return;
      }

      const responsavelNormalizado = String(p.responsavel || "").trim() || "MESA DO CHEFE";
      garantirChave(responsavelNormalizado);
      mapConcluidos.get(responsavelNormalizado)!.push(p);
    });

    const nomesAssessores = Array.from(new Set([...mapAtivos.keys(), ...mapConcluidos.keys()]));
    const nomesAssessoresSet = new Set(
      assessores
        .map((a) => String(a.nome || "").trim())
        .filter(Boolean),
    );

    const assessoresOrdenados = nomesAssessores
      .map((nome) => ({
        nome,
        itensAtivos: mapAtivos.get(nome) || [],
        itensPortariaAssinada: mapPortariaAssinada.get(nome) || [],
        itensAtrasados: mapAtrasados.get(nome) || [],
        itensConcluidos: mapConcluidos.get(nome) || [],
      }))
      .filter(({ nome, itensAtivos, itensPortariaAssinada, itensAtrasados, itensConcluidos }) => {
        if (paColunaLabelSet.has(nome)) {
          return true;
        }
        if (nome === "MESA DO CHEFE") {
          return true;
        }
        if (nomesAssessoresSet.has(nome)) {
          return true;
        }
        return itensAtivos.length > 0 || itensPortariaAssinada.length > 0 || itensAtrasados.length > 0 || itensConcluidos.length > 0;
      })
      .sort((a, b) => {
        const aEhColunaPA = paColunaLabelSet.has(a.nome);
        const bEhColunaPA = paColunaLabelSet.has(b.nome);
        if (aEhColunaPA && !bEhColunaPA) return -1;
        if (!aEhColunaPA && bEhColunaPA) return 1;
        if (aEhColunaPA && bEhColunaPA) {
          return paColunaLabels.indexOf(a.nome) - paColunaLabels.indexOf(b.nome);
        }
        return a.nome.localeCompare(b.nome);
      });

    return assessoresOrdenados;
  }, [processosEfetivos, paColunaLabelPorId, paColunaLabels, paColunaLabelSet, assessores]);

  if (grupos.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Nenhum processo PA ativo nesta visão.</p>
      </div>
    );
  }

  const colunasPAEmAndamento = grupos.filter((a) => paColunaLabelSet.has(a.nome));
  const colunasPAAssessores = grupos.filter((a) => !paColunaLabelSet.has(a.nome));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const within = pointerWithin(args);
        return within.length > 0 ? within : closestCenter(args);
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <section>
        <div className="mb-3">
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border-[var(--tipo-pa)]/30">
            Assessores PA
          </span>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
            {colunasPAEmAndamento.map((a) => (
              <AssessorGroup
                key={`PA-${a.nome}`}
                responsavel={a.nome}
                tipo="PA"
                processos={a.itensAtivos}
                processosPortariaAssinada={a.itensPortariaAssinada}
                processosAtrasados={a.itensAtrasados}
                processosConcluidos={a.itensConcluidos}
                ehAdmin={ehAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onReativarProcesso={onReativarProcesso}
                siteSettings={siteSettings}
                unreadProcessIds={unreadProcessIds}
                onReadProcess={onReadProcess}
                isWide={a.nome === paColunaLabelPorId.get("sindicancia")}
                mapaCoresAssessores={mapaCoresAssessores}
              />
            ))}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
            {colunasPAAssessores.map((a) =>
              a.nome === "MESA DO CHEFE" ? (
                <ChefeGroup
                  key={`PA-chefe-${a.nome}`}
                  responsavel={a.nome}
                  tipo="PA"
                  processos={[
                    ...a.itensAtivos,
                    ...a.itensAtrasados,
                    ...a.itensConcluidos,
                    ...a.itensPortariaAssinada,
                  ]}
                  ehAdmin={ehAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={onMove}
                  onReativarProcesso={onReativarProcesso}
                  siteSettings={siteSettings}
                  unreadProcessIds={unreadProcessIds}
                  onReadProcess={onReadProcess}
                  mapaCoresAssessores={mapaCoresAssessores}
                />
              ) : (
                <AssessorGroup
                  key={`PA-assessor-${a.nome}`}
                  responsavel={a.nome}
                  tipo="PA"
                  processos={a.itensAtivos}
                  processosPortariaAssinada={a.itensPortariaAssinada}
                  processosAtrasados={a.itensAtrasados}
                  processosConcluidos={a.itensConcluidos}
                  ehAdmin={ehAdmin}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMove={onMove}
                  onReativarProcesso={onReativarProcesso}
                  siteSettings={siteSettings}
                  unreadProcessIds={unreadProcessIds}
                  onReadProcess={onReadProcess}
                  mapaCoresAssessores={mapaCoresAssessores}
                />
              )
            )}
          </div>
        </div>
      </section>

      <DragOverlay>
        {activeProcesso ? (
          <div className="opacity-80 rotate-3 scale-105">
            <CardPA
              p={activeProcesso}
              ehAdmin={ehAdmin}
              onEdit={() => {}}
              onDelete={() => {}}
              isDragging={true}
              naoLido={!!(activeProcesso && unreadProcessIds?.has(activeProcesso.id))}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
