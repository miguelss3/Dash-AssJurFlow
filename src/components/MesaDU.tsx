import { useMemo, useState } from "react";
import type { Processo, StatusProcesso, TipoProcesso, FiltroPrazo } from "@/types/processo";
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
import { CardDU } from "./CardDU";
import type { SiteSettings } from "@/types/siteSettings";
import { DEFAULT_DU_BOARD_COLUMNS } from "@/types/siteSettings";
import { diasRestantes, statusPrazo } from "@/lib/prazo";

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
  filtro?: FiltroPrazo;
  busca?: string;
}

export function MesaDU({
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
  filtro,
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

  const duBoardColumns = useMemo(() => {
    const base = siteSettings?.duBoardColumns?.length
      ? siteSettings.duBoardColumns
      : DEFAULT_DU_BOARD_COLUMNS;

    return [...base]
      .filter((coluna) => coluna.enabled !== false)
      .sort((a, b) => a.order - b.order)
      .map((coluna) => ({
        ...coluna,
        label: String(coluna.label || "").trim() || coluna.id,
      }));
  }, [siteSettings?.duBoardColumns]);

  const duColunaAguardandoResposta = useMemo(
    () => duBoardColumns.find((c) => c.id === "aguardando_resposta")?.label || "📩 Aguardando Resposta",
    [duBoardColumns],
  );

  const duColunaAguardandoAssinatura = useMemo(
    () => duBoardColumns.find((c) => c.id === "aguardando_assinatura")?.label || "✍️ Aguardando Assinatura",
    [duBoardColumns],
  );

  const duColunaAguardandoDistribuicao = useMemo(
    () => duBoardColumns.find((c) => c.id === "aguardando_distribuicao")?.label || "📥 Aguardando Distribuicao",
    [duBoardColumns],
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

    // V2.17 — Drop nas colunas de fluxo retroage situacaoFluxo e libera o responsável.
    const RETROCESSO_FLUXO: Record<string, string> = {
      "MESA DO CHEFE": "enviado_admin",
      [duColunaAguardandoAssinatura]: "AGUARDANDO_ASSINATURA",
      [duColunaAguardandoResposta]: "AGUARDANDO_RESPOSTA",
    };

    if (novoResponsavel in RETROCESSO_FLUXO) {
      const processoId = active.id as string;
      const processoAtual = processosEfetivos.find((p) => p.id === processoId);
      const responsavelAnterior = processoAtual?.responsavel || "";
      const situacaoFluxo = RETROCESSO_FLUXO[novoResponsavel];
      const mensagemHistorico = `Fluxo retroagido manualmente para ${novoResponsavel}`;

      if (onRedistribuir) {
        Promise.resolve(
          onRedistribuir(processoId, responsavelAnterior, { situacaoFluxo, mensagemHistorico }),
        ).catch(() => {
          // Sem otimismo a reverter: o snapshot do Firestore reabsorve o estado real.
        });
      }

      setActiveId(null);
      setActiveProcesso(null);
      return;
    }

    const processoId = active.id as string;
    const processoAtual = processosEfetivos.find((p) => p.id === processoId);
    const responsavelAnterior = processoAtual?.responsavel || "";

    if (onRedistribuir) {
      const responsavelFinal = novoResponsavel.includes("📥 Aguardando") ? "" : novoResponsavel;

      // V3.2 — Anti-Limbo DU: se o card vier de uma fase de Chefia
      // (situacaoFluxo CHEFIA_*) e estiver sendo solto numa coluna de
      // assessor (responsavelFinal não vazio), forçamos o retorno do
      // pedidoSubsidios.situacaoFluxo para "MESA_ASSESSOR" — evitando
      // que o card volte a aparecer em "MESA DO CHEFE" e suma da UI.
      const situacaoFluxoAtual = (processoAtual?.pedidoSubsidios?.situacaoFluxo || "")
        .toString()
        .toUpperCase();
      const vinhaDaChefia =
        situacaoFluxoAtual === "CHEFIA_DILIGENCIA"
        || situacaoFluxoAtual === "CHEFIA_DEFESA";
      const opcoesRedistribuicao =
        responsavelFinal && vinhaDaChefia
          ? {
              situacaoFluxo: "MESA_ASSESSOR",
              mensagemHistorico: `Processo devolvido ao assessor ${responsavelFinal} via Mesa DU.`,
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

  const grupos = useMemo(() => {
    const ativos = processosEfetivos.filter((p) => !p.finalizado && p.status !== "concluido");

    const SITUACOES_PENDENCIA_CHEFIA = new Set([
      "aguardando_assinatura_secao",
      "aguardando_aprovacao_externa",
      "enviado_admin",
      "CHEFIA_DILIGENCIA",
      "CHEFIA_DEFESA",
    ]);

    const isPendenciaChefiaPorId = new Map<string, boolean>();
    const isAguardandoAssinaturaPorId = new Map<string, boolean>();
    const isAguardandoRespostaPorId = new Map<string, boolean>();
    const isAguardandoRespostaVencidoPorId = new Map<string, boolean>();

    for (const p of processosEfetivos) {
      const situacaoFluxoPedido = p.pedidoSubsidios?.situacaoFluxo || "";
      const statusNorm = (p.status || "").toString().toLowerCase();

      const aguardandoAssinatura =
        situacaoFluxoPedido === "AGUARDANDO_ASSINATURA" || statusNorm === "aguardando assinatura";
      isAguardandoAssinaturaPorId.set(p.id, aguardandoAssinatura);

      const pendenciaChefia =
        (SITUACOES_PENDENCIA_CHEFIA.has(situacaoFluxoPedido)
          // CHEFIA_DILIGENCIA/CHEFIA_DEFESA sem responsavel = estado inválido; tratar como distribuição
          && !(
            (situacaoFluxoPedido === "CHEFIA_DILIGENCIA" || situacaoFluxoPedido === "CHEFIA_DEFESA")
            && !String(p.responsavel || "").trim()
          ))
        || statusNorm.includes("aguardando chem");
      isPendenciaChefiaPorId.set(p.id, pendenciaChefia);

      const aguardandoResposta =
        situacaoFluxoPedido === "AGUARDANDO_RESPOSTA" || statusNorm === "aguardando resposta";
      isAguardandoRespostaPorId.set(p.id, aguardandoResposta);

      if (aguardandoResposta) {
        const prazoResposta = p.pedidoSubsidios?.prazoResposta;
        const prazoFatal = p.prazoFatal;
        const vencido =
          statusPrazo(prazoResposta) === "overdue"
          || statusPrazo(prazoFatal) === "overdue";
        isAguardandoRespostaVencidoPorId.set(p.id, vencido);
      } else {
        isAguardandoRespostaVencidoPorId.set(p.id, false);
      }
    }

    const doTipo = ativos;
    const concluidosDoTipo = processosEfetivos.filter((p) => p.finalizado === true || p.status === "concluido");

    const aguardandoRespostaDUAtivos: Processo[] = [];
    const aguardandoRespostaDUVencidos: Processo[] = [];
    const aguardandoAssinaturaDU: Processo[] = [];
    const pendenciasChefia: Processo[] = [];
    const doTipoSemPendenciasChefia: Processo[] = [];

    for (const p of doTipo) {
      const aguardando = isAguardandoRespostaPorId.get(p.id) === true;

      if (aguardando) {
        if (isAguardandoRespostaVencidoPorId.get(p.id)) {
          aguardandoRespostaDUVencidos.push(p);
        } else {
          aguardandoRespostaDUAtivos.push(p);
        }
        continue;
      }

      if (isAguardandoAssinaturaPorId.get(p.id)) {
        aguardandoAssinaturaDU.push(p);
        continue;
      }

      if (isPendenciaChefiaPorId.get(p.id)) {
        pendenciasChefia.push(p);
        continue;
      }

      doTipoSemPendenciasChefia.push(p);
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

    garantirChave("MESA DO CHEFE");
    mapAtivos.set("MESA DO CHEFE", pendenciasChefia);

    garantirChave(duColunaAguardandoResposta);
    mapAtivos.set(duColunaAguardandoResposta, aguardandoRespostaDUAtivos);
    mapAtrasados.set(duColunaAguardandoResposta, aguardandoRespostaDUVencidos);

    garantirChave(duColunaAguardandoAssinatura);
    mapAtivos.set(duColunaAguardandoAssinatura, aguardandoAssinaturaDU);

    garantirChave(duColunaAguardandoDistribuicao);

    // V3.6 — Regra estrita: processos em CHEFIA_DILIGENCIA/CHEFIA_DEFESA
    // pertencem EXCLUSIVAMENTE à coluna "MESA DO CHEFE". A regra anterior
    // (V3.2 Auto-Resgate Anti-Limbo) os duplicava na coluna do assessor,
    // gerando o card-fantasma. A blindagem agora é feita no drag&drop:
    // soltar na coluna do assessor força situacaoFluxo → MESA_ASSESSOR.

    doTipoSemPendenciasChefia.forEach((p) => {
      let responsavelKey = p.responsavel || "";
      if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
        responsavelKey = duColunaAguardandoDistribuicao;
      }
      if (!responsavelKey) return;
      garantirChave(responsavelKey);
      mapAtivos.get(responsavelKey)!.push(p);
    });

    concluidosDoTipo.forEach((p) => {
      let responsavelKey = p.responsavel || "";
      if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
        responsavelKey = duColunaAguardandoDistribuicao;
      }
      if (!responsavelKey) return;
      garantirChave(responsavelKey);
      mapConcluidos.get(responsavelKey)!.push(p);
    });

    const assessoresDesteTipo = assessores;
    assessoresDesteTipo.forEach((assessor) => garantirChave(assessor.nome));

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
        if (
          nome === "MESA DO CHEFE"
          || nome === duColunaAguardandoAssinatura
          || nome === duColunaAguardandoResposta
          || nome === duColunaAguardandoDistribuicao
        ) {
          return true;
        }
        if (nomesAssessoresSet.has(nome)) {
          return true;
        }
        return itensAtivos.length > 0 || itensPortariaAssinada.length > 0 || itensAtrasados.length > 0 || itensConcluidos.length > 0;
      })
      .sort((a, b) => {
        if (a.nome.includes("MESA DO CHEFE")) return -1;
        if (b.nome.includes("MESA DO CHEFE")) return 1;
        if (a.nome === duColunaAguardandoAssinatura) return -1;
        if (b.nome === duColunaAguardandoAssinatura) return 1;
        if (a.nome === duColunaAguardandoResposta) return -1;
        if (b.nome === duColunaAguardandoResposta) return 1;
        if (a.nome === duColunaAguardandoDistribuicao) return -1;
        if (b.nome === duColunaAguardandoDistribuicao) return 1;
        return a.nome.localeCompare(b.nome);
      });

    return assessoresOrdenados;
  }, [
    processosEfetivos,
    assessores,
    duColunaAguardandoResposta,
    duColunaAguardandoAssinatura,
    duColunaAguardandoDistribuicao,
  ]);

  if (grupos.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Nenhum processo DU ativo nesta visão.</p>
      </div>
    );
  }

  const colunasDUFixas = grupos
    .filter((a) => (
      a.nome === "MESA DO CHEFE"
      || a.nome === duColunaAguardandoAssinatura
      || a.nome === duColunaAguardandoResposta
      || a.nome === duColunaAguardandoDistribuicao
    ))
    .sort((a, b) => {
      if (a.nome === "MESA DO CHEFE") return -1;
      if (b.nome === "MESA DO CHEFE") return 1;
      if (a.nome === duColunaAguardandoAssinatura) return -1;
      if (b.nome === duColunaAguardandoAssinatura) return 1;
      if (a.nome === duColunaAguardandoResposta) return -1;
      if (b.nome === duColunaAguardandoResposta) return 1;
      if (a.nome === duColunaAguardandoDistribuicao) return -1;
      if (b.nome === duColunaAguardandoDistribuicao) return 1;
      return 0;
    });

  const colunasDUAssessores = grupos.filter(
    (a) =>
      a.nome !== "MESA DO CHEFE"
      && a.nome !== duColunaAguardandoAssinatura
      && a.nome !== duColunaAguardandoResposta
      && a.nome !== duColunaAguardandoDistribuicao,
  );

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
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider border bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border-[var(--tipo-du)]/30">
            Assessores DU
          </span>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
            {colunasDUFixas.map((a) =>
              a.nome === "MESA DO CHEFE" ? (
                <ChefeGroup
                  key={`DU-chefe-${a.nome}`}
                  responsavel={a.nome}
                  tipo="DU"
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
                  key={`DU-fixa-${a.nome}`}
                  responsavel={a.nome}
                  tipo="DU"
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
                  filtro={filtro}
                  busca={busca}
                  mapaCoresAssessores={mapaCoresAssessores}
                />
              )
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
            {colunasDUAssessores.map((a) =>
              a.nome === "MESA DO CHEFE" ? (
                <ChefeGroup
                  key={`DU-chefe-${a.nome}`}
                  responsavel={a.nome}
                  tipo="DU"
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
                  key={`DU-assessor-${a.nome}`}
                  responsavel={a.nome}
                  tipo="DU"
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
                  filtro={filtro}
                  busca={busca}
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
            <CardDU
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
