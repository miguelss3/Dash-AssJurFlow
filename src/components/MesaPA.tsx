import { useCallback, useMemo, useState } from "react";
import type { Processo, StatusProcesso, TipoProcesso, FiltroPrazo } from "@/types/processo";
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
  filtro?: FiltroPrazo;
  busca?: string;
  /** nomeMilitar -> dataRetorno (YYYY-MM-DD) para quem está de férias hoje. */
  bloqueiosFerias?: Record<string, string>;
}

// Coluna "Aguardando Distribuição" — mesmos moldes/características do DU:
// processos sem responsável, aguardando a chefia indicar um assessor.
// V9.9 — também recebe o que antes ia para "Mesa do Chefe" (removida de PA
// por enquanto): pendências de chefia sem assessor nomeado.
const PA_COLUNA_AGUARDANDO_DISTRIBUICAO = "📥 Aguardando Distribuicao";

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
  filtro,
  busca,
  bloqueiosFerias,
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
      // Soltar em "Aguardando Distribuição" limpa o responsável (mesmo
      // comportamento do DU) — essa coluna não é nome de assessor.
      const responsavelFinal =
        novoResponsavel === ""
        || novoResponsavel === PA_COLUNA_AGUARDANDO_DISTRIBUICAO
          ? ""
          : novoResponsavel;

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

  const classificarPA = useCallback((p: Processo, tipoNorm: string): { emAndamento: string | null; portaria: string | null; aguardandoAssinaturaSolucao: string | null; atrasado: boolean } => {
    const situacaoFluxo = normalizarSituacao(p.situacaoFluxo);
    const situacaoPA = normalizarSituacao(p.situacaoFluxoPA);
    const situacaoConselho = normalizarSituacao(p.situacaoFluxoConselho);
    const situacaoIP = normalizarSituacao(p.situacaoFluxoIP);

    // 1. Identifica a coluna
    let colunaTipo: string | null = null;
    if (tipoNorm.includes("conselho")) colunaTipo = paColunaLabelPorId.get("conselho") || "📕 Conselhos";
    else if (tipoNorm.includes("ipm")) colunaTipo = paColunaLabelPorId.get("ipm") || "📘 IPM";
    else if (tipoNorm.includes("sindic")) colunaTipo = paColunaLabelPorId.get("sindicancia") || "📗 Sindicancias";

    // 2. Verifica se está fechado
    const stNorm = String(p.status || "").trim().toLowerCase();
    // V6.6 — Processos reabertos (processoReaberto=true) podem manter um
    // situacaoFluxoPA/Conselho/IP="FINALIZADO" residual de antes da reabertura,
    // enquanto `finalizado`/`status` já foram corretamente atualizados para
    // ativo. Sem esta guarda, o processo some do dash (fica com
    // emAndamento=null, portaria=null, atrasado=false) mesmo estando ativo e
    // vencido — foi o que aconteceu com a Portaria 14/2026.
    const finalizadoNovo =
      (!p.processoReaberto &&
        (situacaoPA === "FINALIZADO" ||
          situacaoConselho === "FINALIZADO" ||
          situacaoIP === "FINALIZADO")) ||
      p.finalizado === true ||
      stNorm === "concluido" ||
      stNorm === "concluído";

    if (finalizadoNovo) {
      return { emAndamento: null, portaria: null, aguardandoAssinaturaSolucao: null, atrasado: false };
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
      return { emAndamento: null, portaria: colunaTipo, aguardandoAssinaturaSolucao: null, atrasado: false };
    }

    // V9.13 — Solução despachada para a Chefia (ASSINANDO_SOLUCAO) sai da
    // Mesa do Assessor e ganha aba própria na coluna de tipo ("Solução
    // Aguardando Assinatura") — separado de "No Prazo"/"Em Atraso", que são
    // só para quem ainda está sendo trabalhado (encarregado ou assessor
    // redigindo). FAZENDO_SOLUCAO (ainda em elaboração) continua no fluxo
    // normal abaixo, visível tanto na coluna de tipo quanto na Mesa do
    // Assessor (V9.11).
    if (situacaoPA === "ASSINANDO_SOLUCAO" && colunaTipo) {
      return { emAndamento: null, portaria: null, aguardandoAssinaturaSolucao: colunaTipo, atrasado: false };
    }

    // 4. Se chegou aqui, está na mão do Encarregado (Em Andamento Real) —
    // ou, para tipos sem coluna fixa (Investigação Preliminar/Outros), na
    // mesa do assessor/Aguardando Distribuição. O atraso é calculado pelo
    // prazo em ambos os casos, senão o filtro "Vencidos" nunca encontra
    // esses processos (ficavam sempre com atrasado=false).
    let emAndamento: string | null = null;
    const prazoBase = p.prazoFatal || p.finalPrazo;
    const atrasado = Boolean(prazoBase && diasRestantes(prazoBase) < 0);

    if (colunaTipo) {
      emAndamento = colunaTipo;
    }

    return { emAndamento, portaria: null, aguardandoAssinaturaSolucao: null, atrasado };
  }, [paColunaLabelPorId]);

  // V9.8 — Coluna de tipo para processos CONCLUÍDOS. Diferente de
  // `classificarPA` (que só resolve a coluna de processos ativos, e nem
  // sempre chega a esse ponto para finalizados — ver early-return acima),
  // esta função classifica pelo tipoPA puro, sem olhar a situação do fluxo,
  // e inclui Investigação Preliminar/Outros (coluna "outros"), que não tem
  // coluna de ativos própria mas passa a ter uma aba de Concluídos.
  const obterColunaConcluidosPorTipo = useCallback((tipoNorm: string): string | null => {
    if (tipoNorm.includes("conselho")) return paColunaLabelPorId.get("conselho") || "⚖ Conselhos";
    if (tipoNorm.includes("ipm")) return paColunaLabelPorId.get("ipm") || "📘 IPM";
    if (tipoNorm.includes("sindic")) return paColunaLabelPorId.get("sindicancia") || "📗 Sindicancias";
    if (tipoNorm.includes("investigacao preliminar") || tipoNorm === "outros") {
      return paColunaLabelPorId.get("outros") || "📄 Outros Processos";
    }
    return null;
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
    const colunaPAAguardandoAssinaturaSolucaoPorId = new Map<string, string | null>();
    const colunaConcluidosPorId = new Map<string, string | null>();
    const isPAAtrasadoPorId = new Map<string, boolean>();

    for (const p of processosEfetivos) {
      const tipoPANorm = (p.tipoPA || p.subtipo || "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      const { emAndamento, portaria, aguardandoAssinaturaSolucao, atrasado } = classificarPA(p, tipoPANorm);
      colunaPAEmAndamentoPorId.set(p.id, emAndamento);
      colunaPAPortariaAssinadaPorId.set(p.id, portaria);
      colunaPAAguardandoAssinaturaSolucaoPorId.set(p.id, aguardandoAssinaturaSolucao);
      colunaConcluidosPorId.set(p.id, obterColunaConcluidosPorTipo(tipoPANorm));
      isPAAtrasadoPorId.set(p.id, atrasado);
    }

    const mapAtivos = new Map<string, Processo[]>();
    const mapPortariaAssinada = new Map<string, Processo[]>();
    const mapAguardandoAssinaturaSolucao = new Map<string, Processo[]>();
    const mapAtrasados = new Map<string, Processo[]>();
    const mapConcluidos = new Map<string, Processo[]>();

    // Mesa do Assessor: conjunto estritamente limitado às fases em que a
    // atuação da Assessoria Jurídica é necessária.
    const mapAssessorAtivos = new Map<string, Processo[]>();
    const mapAssessorConcluidos = new Map<string, Processo[]>();
    // Subconjunto vencido de mapAssessorAtivos — alimenta a aba "Atrasado"
    // da Mesa do Assessor (o item continua também em mapAssessorAtivos,
    // que já engloba ativos+atrasados na aba "Em Andamento").
    const mapAssessorAtrasados = new Map<string, Processo[]>();

    const garantirChave = (chave: string) => {
      if (!mapAtivos.has(chave)) mapAtivos.set(chave, []);
      if (!mapPortariaAssinada.has(chave)) mapPortariaAssinada.set(chave, []);
      if (!mapAguardandoAssinaturaSolucao.has(chave)) mapAguardandoAssinaturaSolucao.set(chave, []);
      if (!mapAtrasados.has(chave)) mapAtrasados.set(chave, []);
      if (!mapConcluidos.has(chave)) mapConcluidos.set(chave, []);
      if (!mapAssessorAtivos.has(chave)) mapAssessorAtivos.set(chave, []);
      if (!mapAssessorConcluidos.has(chave)) mapAssessorConcluidos.set(chave, []);
      if (!mapAssessorAtrasados.has(chave)) mapAssessorAtrasados.set(chave, []);
    };

    paColunaLabels.forEach(garantirChave);
    garantirChave(PA_COLUNA_AGUARDANDO_DISTRIBUICAO);
    assessores.forEach((assessor) => {
      const nomeAssessor = String(assessor.nome || "").trim();
      if (nomeAssessor) garantirChave(nomeAssessor);
    });

    ativos.forEach((p) => {
      const responsavelAssessor = String(p.responsavel || "").trim();
      const sitPA = normalizarSituacao(p.situacaoFluxoPA);
      const sitConselho = normalizarSituacao(p.situacaoFluxoConselho);
      const sitLegado = normalizarSituacao(p.situacaoFluxo);

      const colunaPortariaAssinadaPA = colunaPAPortariaAssinadaPorId.get(p.id) || null;
      const colunaEspecialPA = colunaPAEmAndamentoPorId.get(p.id) || null;
      const colunaAguardandoAssinaturaSolucaoPA = colunaPAAguardandoAssinaturaSolucaoPorId.get(p.id) || null;
      // V6.5 — "Bloquear Mesa do Assessor" (COM_ENCARREGADO etc.) só faz
      // sentido quando existe uma coluna de tipo (Sindicância/IPM/Conselho)
      // para o processo cair em seu lugar. Para Investigação Preliminar/Outros
      // (sem coluna de tipo), bloquear aqui fazia o processo sumir do
      // dashboard: ele era excluído da Mesa do Assessor (bloqueado) e também
      // não aparecia em nenhuma coluna de tipo (não existe), pois a coluna do
      // assessor nomeado só exibe o total vindo de mapAssessorAtivos/Atrasados.
      const temColunaDeTipo = Boolean(colunaPortariaAssinadaPA || colunaEspecialPA || colunaAguardandoAssinaturaSolucaoPA);

      const bloquearMesaAssessorPA =
        temColunaDeTipo && (
          sitPA === "COM_ENCARREGADO" ||
          sitPA === "ASSINANDO_PORTARIA" ||
          sitPA === "AGUARDANDO_ENTREGA" ||
          sitPA === "AGUARDANDO_PRAZO" ||
          // V9.13 — Solução despachada para assinatura: sai da Mesa do
          // Assessor, fica só na aba "Solução Aguardando Assinatura".
          sitPA === "ASSINANDO_SOLUCAO" ||
          sitConselho === "COM_CONSELHO" ||
          sitLegado === "EM_CURSO" ||
          sitLegado === "C_EM_CURSO" ||
          sitLegado === "AGUARDANDO_PRAZO"
        );

      if (responsavelAssessor && !bloquearMesaAssessorPA) {
        garantirChave(responsavelAssessor);
        mapAssessorAtivos.get(responsavelAssessor)!.push(p);
        if (isPAAtrasadoPorId.get(p.id)) {
          mapAssessorAtrasados.get(responsavelAssessor)!.push(p);
        }
      }

      if (colunaPortariaAssinadaPA) {
        mapPortariaAssinada.get(colunaPortariaAssinadaPA)!.push(p);
        return;
      }

      if (colunaAguardandoAssinaturaSolucaoPA) {
        mapAguardandoAssinaturaSolucao.get(colunaAguardandoAssinaturaSolucaoPA)!.push(p);
        return;
      }

      if (colunaEspecialPA) {
        if (isPAAtrasadoPorId.get(p.id)) {
          mapAtrasados.get(colunaEspecialPA)!.push(p);
        } else {
          mapAtivos.get(colunaEspecialPA)!.push(p);
        }
        return;
      }

      // V9.9 — Sem coluna do tipo (ex.: Investigação Preliminar) e sem
      // assessor: tudo (pendência de chefia ou não) vai para "Aguardando
      // Distribuição" — "Mesa do Chefe" foi removida de PA por enquanto.
      const responsavelBruto = String(p.responsavel || "").trim();
      const responsavelNormalizado = responsavelBruto || PA_COLUNA_AGUARDANDO_DISTRIBUICAO;
      garantirChave(responsavelNormalizado);

      // "Aguardando Distribuição" só tem a aba "Em Andamento" (ver
      // AssessorGroup — colunas de transição não exibem aba "Atrasado"),
      // então um processo vencido ali precisa permanecer em itensAtivos ou
      // desaparece da tela. O desvio para o bucket de atrasados só faz
      // sentido para colunas de assessor nomeado (que têm aba própria).
      const colunaTemAbaAtraso = Boolean(responsavelBruto);
      if (colunaTemAbaAtraso && isPAAtrasadoPorId.get(p.id)) {
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

      // V9.8 — Redistribui pelo TIPO DE PROCESSO concluído (Sindicância/IPM/
      // Conselho/Outros), não mais pelo bucket do assessor responsável —
      // `colunaConcluidosPorId` classifica pelo tipoPA puro (diferente de
      // `colunaPAEmAndamentoPorId`, que fica null para tudo que é finalizado).
      const colunaTipoConcluido = colunaConcluidosPorId.get(p.id) || null;
      if (colunaTipoConcluido) {
        garantirChave(colunaTipoConcluido);
        mapConcluidos.get(colunaTipoConcluido)!.push(p);
        return;
      }

      const responsavelNormalizado = responsavelAssessor || PA_COLUNA_AGUARDANDO_DISTRIBUICAO;
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
        itensAguardandoAssinaturaSolucao: mapAguardandoAssinaturaSolucao.get(nome) || [],
        itensAtrasados: mapAtrasados.get(nome) || [],
        itensConcluidos: mapConcluidos.get(nome) || [],
        // V6.4 — Conjunto completo por responsável para a Mesa do Assessor.
        itensAssessorAtivosTotal: mapAssessorAtivos.get(nome) || [],
        itensAssessorConcluidosTotal: mapAssessorConcluidos.get(nome) || [],
        itensAssessorAtrasadosTotal: mapAssessorAtrasados.get(nome) || [],
      }))
      .filter(({ nome, itensAtivos, itensPortariaAssinada, itensAtrasados, itensConcluidos }) => {
        if (paColunaLabelSet.has(nome)) {
          return true;
        }
        if (nome === PA_COLUNA_AGUARDANDO_DISTRIBUICAO) {
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
  }, [processosEfetivos, paColunaLabels, paColunaLabelSet, assessores, classificarPA, obterColunaConcluidosPorTipo]);

  if (grupos.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Nenhum processo PA ativo nesta visão.</p>
      </div>
    );
  }

  // V9.9 — "Mesa do Chefe" removida de PA (sem pendência de chefia separada
  // por enquanto): tudo que caía lá agora vai para "Aguardando Distribuição",
  // que fecha a linha, exatamente como fica em DU (última coluna à direita).
  const colunaPAAguardandoDistribuicao = grupos.find((a) => a.nome === PA_COLUNA_AGUARDANDO_DISTRIBUICAO);

  const colunasPAEmAndamento = grupos.filter((a) => paColunaLabelSet.has(a.nome));
  const colunasPAAssessores = grupos.filter(
    (a) =>
      !paColunaLabelSet.has(a.nome)
      && a.nome !== PA_COLUNA_AGUARDANDO_DISTRIBUICAO,
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
                processosAguardandoAssinaturaSolucao={a.itensAguardandoAssinaturaSolucao}
                processosAtrasados={a.itensAtrasados}
                processosConcluidos={a.itensConcluidos}
                apenasAbaConcluidos={a.nome === (paColunaLabelPorId.get("outros") || "📄 Outros Processos")}
                ordenarColunaPorNumero={a.nome !== (paColunaLabelPorId.get("outros") || "📄 Outros Processos")}
                isWide
                ehAdmin={ehAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onReativarProcesso={onReativarProcesso}
                siteSettings={siteSettings}
                unreadProcessIds={unreadProcessIds}
                onReadProcess={onReadProcess}
                mapaCoresAssessores={mapaCoresAssessores}
                emFeriasAte={bloqueiosFerias?.[a.nome]}
                filtro={filtro}
              />
            ))}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
            {colunaPAAguardandoDistribuicao && (
              <AssessorGroup
                key={`PA-fixa-${colunaPAAguardandoDistribuicao.nome}`}
                responsavel={colunaPAAguardandoDistribuicao.nome}
                tipo="PA"
                processos={colunaPAAguardandoDistribuicao.itensAtivos}
                processosPortariaAssinada={colunaPAAguardandoDistribuicao.itensPortariaAssinada}
                processosAtrasados={colunaPAAguardandoDistribuicao.itensAtrasados}
                processosConcluidos={colunaPAAguardandoDistribuicao.itensConcluidos}
                ehAdmin={ehAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onReativarProcesso={onReativarProcesso}
                siteSettings={siteSettings}
                unreadProcessIds={unreadProcessIds}
                onReadProcess={onReadProcess}
                mapaCoresAssessores={mapaCoresAssessores}
                emFeriasAte={bloqueiosFerias?.[colunaPAAguardandoDistribuicao.nome]}
                filtro={filtro}
              />
            )}
            {colunasPAAssessores.map((a) => (
              <AssessorGroup
                key={`PA-assessor-${a.nome}`}
                responsavel={a.nome}
                tipo="PA"
                processos={a.itensAssessorAtivosTotal}
                processosPortariaAssinada={[]}
                processosAtrasados={a.itensAssessorAtrasadosTotal}
                processosConcluidos={a.itensAssessorConcluidosTotal}
                vistaAssessor
                isWide
                ehAdmin={ehAdmin}
                onEdit={onEdit}
                onDelete={onDelete}
                onMove={onMove}
                onReativarProcesso={onReativarProcesso}
                siteSettings={siteSettings}
                unreadProcessIds={unreadProcessIds}
                onReadProcess={onReadProcess}
                mapaCoresAssessores={mapaCoresAssessores}
                emFeriasAte={bloqueiosFerias?.[a.nome]}
                filtro={filtro}
              />
            ))}
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
