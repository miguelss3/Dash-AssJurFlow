import { useCallback, useMemo, useState } from "react";
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

// V5.2 — Classificação universal das abas PA para todos os motores.
const PORTARIA_LEGADA = new Set([
  "AGUARDANDO_PRAZO",
  "AGUARDANDO_ENTREGA",
  "AGUARDANDO_CHEFIA",
  "AGUARDANDO_CHEFIA_SOLUCAO",
  "C_MEMORIA",
  "C_PORTARIA",
]);

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

      const tipoPANorm = String(processoAtual?.tipoPA || processoAtual?.subtipo || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      const ehIP =
        tipoPANorm.includes("investigacao preliminar")
        || tipoPANorm.includes("investigacao")
        || tipoPANorm.includes("ipm")
        || tipoPANorm === "outros";

      const opcoesRedistribuicao = ehIP
        ? {
            situacaoFluxo: "MESA_ASSESSOR",
            mensagemHistorico: `Processo redistribuído para ${responsavelFinal} (Mesa do Assessor).`,
          }
        : undefined;

      setResponsaveisOtimizados((prev) => ({
        ...prev,
        [processoId]: responsavelFinal,
      }));

      Promise.resolve(onRedistribuir(processoId, responsavelFinal, opcoesRedistribuicao)).catch(() => {
        setResponsaveisOtimizados((prev) => ({
          ...prev,
          [processoId]: responsavelAnterior,
        }));
      });
    }

    setActiveId(null);
    setActiveProcesso(null);
  };

  const normalizarSituacao = (valor: unknown) =>
    String(valor || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const classificarPA = useCallback((p: Processo, tipoNorm: string): { emAndamento: string | null; portaria: string | null; atrasado: boolean } => {
    const situacaoFluxo = normalizarSituacao(p.situacaoFluxo);
    const situacaoPA = normalizarSituacao(p.situacaoFluxoPA);
    const situacaoConselho = normalizarSituacao(p.situacaoFluxoConselho);
    const situacaoIP = normalizarSituacao(p.situacaoFluxoIP);

    const isFaseAssessorSolucao =
      situacaoPA === "FAZENDO_SOLUCAO" ||
      situacaoPA === "ASSINANDO_SOLUCAO";

    // 1. Identifica a coluna
    let colunaTipo: string | null = null;
    if (tipoNorm.includes("conselho")) colunaTipo = paColunaLabelPorId.get("conselho") || "📕 Conselhos";
    else if (tipoNorm.includes("ipm")) colunaTipo = paColunaLabelPorId.get("ipm") || "📘 IPM";
    else if (tipoNorm.includes("sindic")) colunaTipo = paColunaLabelPorId.get("sindicancia") || "📗 Sindicancias";

    // 2. Verifica se está fechado
    const stNorm = String(p.status || "").trim().toLowerCase();
    const finalizadoNovo =
      situacaoPA === "FINALIZADO" ||
      situacaoConselho === "FINALIZADO" ||
      situacaoIP === "FINALIZADO" ||
      p.finalizado === true ||
      stNorm === "concluido" ||
      stNorm === "concluído";

    if (finalizadoNovo) {
      return { emAndamento: null, portaria: null, atrasado: false };
    }

    // 3. Verifica se é portaria assinada E trava (BLINDAGEM CONTRA DUPLA CONTAGEM)
    const isPortariaAssinada =
      situacaoPA === "ASSINANDO_PORTARIA" ||
      situacaoPA === "AGUARDANDO_ENTREGA" ||
      situacaoPA === "AGUARDANDO_PRAZO" ||
      situacaoConselho === "ASSINANDO_PORTARIA" ||
      situacaoIP === "NA_CHEFIA" ||
      PORTARIA_LEGADA.has(situacaoFluxo);

    if (isPortariaAssinada && colunaTipo) {
      return { emAndamento: null, portaria: colunaTipo, atrasado: false };
    }

    // Fase de solução é de atuação direta do assessor responsável.
    // Não deve cair na coluna geral (Sindicâncias/IPM/Conselhos).
    if (isFaseAssessorSolucao) {
      return { emAndamento: null, portaria: null, atrasado: false };
    }

    // 4. Se chegou aqui, está na mão do Encarregado (Em Andamento Real)
    let emAndamento: string | null = null;
    let atrasado = false;

    if (colunaTipo) {
      emAndamento = colunaTipo;
      const prazoBase = p.prazoFatal || p.finalPrazo;
      if (prazoBase && diasRestantes(prazoBase) < 0) {
        atrasado = true;
      }
    }

    return { emAndamento, portaria: null, atrasado };
  }, [paColunaLabelPorId]);

  const grupos = useMemo(() => {
    // V6.2 — Blindagem contra documentos legados: usar ambos os campos para
    // classificar ativos/concluídos. `finalizado` pode estar ausente (undefined)
    // em registros antigos; nesse caso confiamos em `status`.
    const ehProcessoAtivo = (p: Processo) => {
      const statusNorm = String(p.status || "").trim().toLowerCase();
      return p.finalizado !== true && statusNorm !== "concluido" && statusNorm !== "concluído";
    };
    const ehProcessoConcluido = (p: Processo) => {
      const statusNorm = String(p.status || "").trim().toLowerCase();
      return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
    };

    const ativos = processosEfetivos.filter(ehProcessoAtivo);
    const concluidosDoTipo = processosEfetivos.filter(ehProcessoConcluido);

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

    // Mesa do Assessor: conjunto estritamente limitado às fases em que a
    // atuação da Assessoria Jurídica é necessária.
    const mapAssessorAtivos = new Map<string, Processo[]>();
    const mapAssessorConcluidos = new Map<string, Processo[]>();

    const garantirChave = (chave: string) => {
      if (!mapAtivos.has(chave)) mapAtivos.set(chave, []);
      if (!mapPortariaAssinada.has(chave)) mapPortariaAssinada.set(chave, []);
      if (!mapAtrasados.has(chave)) mapAtrasados.set(chave, []);
      if (!mapConcluidos.has(chave)) mapConcluidos.set(chave, []);
      if (!mapAssessorAtivos.has(chave)) mapAssessorAtivos.set(chave, []);
      if (!mapAssessorConcluidos.has(chave)) mapAssessorConcluidos.set(chave, []);
    };

    paColunaLabels.forEach(garantirChave);
    garantirChave("MESA DO CHEFE");
    assessores.forEach((assessor) => {
      const nomeAssessor = String(assessor.nome || "").trim();
      if (nomeAssessor) garantirChave(nomeAssessor);
    });

    ativos.forEach((p) => {
      const responsavelAssessor = String(p.responsavel || "").trim();
      const sitPA = normalizarSituacao(p.situacaoFluxoPA);
      const sitConselho = normalizarSituacao(p.situacaoFluxoConselho);
      const sitLegado = normalizarSituacao(p.situacaoFluxo);

      const bloquearMesaAssessorPA =
        sitPA === "COM_ENCARREGADO" ||
        sitPA === "ASSINANDO_PORTARIA" ||
        sitPA === "AGUARDANDO_ENTREGA" ||
        sitPA === "AGUARDANDO_PRAZO" ||
        sitConselho === "COM_CONSELHO" ||
        sitLegado === "EM_CURSO" ||
        sitLegado === "C_EM_CURSO" ||
        sitLegado === "AGUARDANDO_PRAZO";

      if (responsavelAssessor && !bloquearMesaAssessorPA) {
        garantirChave(responsavelAssessor);
        mapAssessorAtivos.get(responsavelAssessor)!.push(p);
      }

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

      // V5.2 — Sem coluna do tipo (ex.: Investigação Preliminar): usa coluna do
      // assessor mas respeita a aba (Portaria Assinada / Em Atraso).
      const responsavelNormalizado = String(p.responsavel || "").trim() || "MESA DO CHEFE";
      garantirChave(responsavelNormalizado);
      const situacaoIP = normalizarSituacao(p.situacaoFluxoIP);
      const situacaoPA = normalizarSituacao(p.situacaoFluxoPA);
      const situacaoConselho = normalizarSituacao(p.situacaoFluxoConselho);
      const portariaSemColuna =
        situacaoIP === "NA_CHEFIA"
        || situacaoPA === "ASSINANDO_PORTARIA"
        || situacaoPA === "AGUARDANDO_ENTREGA"
        || situacaoConselho === "ASSINANDO_PORTARIA";
      if (portariaSemColuna) {
        mapPortariaAssinada.get(responsavelNormalizado)!.push(p);
        return;
      }
      if (isPAAtrasadoPorId.get(p.id)) {
        mapAtrasados.get(responsavelNormalizado)!.push(p);
        return;
      }
      mapAtivos.get(responsavelNormalizado)!.push(p);
    });

    concluidosDoTipo.forEach((p) => {
      // V6.4 — Também carimba concluídos no bucket do responsável.
      const responsavelAssessor = String(p.responsavel || "").trim();
      if (responsavelAssessor) {
        garantirChave(responsavelAssessor);
        mapAssessorConcluidos.get(responsavelAssessor)!.push(p);
      }

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
        // V6.4 — Conjunto completo por responsável para a Mesa do Assessor.
        itensAssessorAtivosTotal: mapAssessorAtivos.get(nome) || [],
        itensAssessorConcluidosTotal: mapAssessorConcluidos.get(nome) || [],
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
  }, [processosEfetivos, paColunaLabels, paColunaLabelSet, assessores, classificarPA]);

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
            {colunasPAAssessores.map((a) => {
              const isColunaGeral = paColunaLabelSet.has(a.nome);

              return a.nome === "MESA DO CHEFE" ? (
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
                  processos={isColunaGeral ? a.itensAtivos : a.itensAssessorAtivosTotal}
                  processosPortariaAssinada={isColunaGeral ? a.itensPortariaAssinada : []}
                  processosAtrasados={isColunaGeral ? a.itensAtrasados : []}
                  processosConcluidos={isColunaGeral ? a.itensConcluidos : a.itensAssessorConcluidosTotal}
                  vistaAssessor={!isColunaGeral}
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
              );
            })}
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
