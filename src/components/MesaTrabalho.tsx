import { useMemo, useEffect, useState } from "react";
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
import { ProcessoCard } from "./ProcessoCard";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuthUser } from "@/hooks/useAuth";
import { DEFAULT_DU_BOARD_COLUMNS, DEFAULT_PA_EM_ANDAMENTO_COLUMNS, type SiteSettings } from "@/types/siteSettings";
import { normalizarSetorUsuario } from "@/lib/userProfiles";
import { diasRestantes, statusPrazo } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  filtroTipo: "todos" | "DU" | "PA";
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  onRedistribuir?: (
    processoId: string,
    novoResponsavel: string,
    opcoes?: { situacaoFluxo?: string; mensagemHistorico?: string },
  ) => void | Promise<void>;
  usuario?: AuthUser;
  ehAdmin?: boolean;
  unreadProcessIds?: Set<string>;
  onReadProcess?: (processoId: string) => void;
  siteSettings?: SiteSettings;
  filtro?: FiltroPrazo;
  busca?: string;
}

export function MesaTrabalho({ processos, filtroTipo, onEdit, onDelete, onMove, onReativarProcesso, onRedistribuir, usuario, ehAdmin, unreadProcessIds, onReadProcess, siteSettings, filtro, busca }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeProcesso, setActiveProcesso] = useState<Processo | null>(null);
  const [assessoresDoSetor, setAssessoresDoSetor] = useState<{ nome: string; setor: string }[]>([]);
  const [responsaveisOtimizados, setResponsaveisOtimizados] = useState<Record<string, string>>({});

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

  // V2.6 — Coluna "Aguardando Assinatura" (estacionamento da Vigília SPED).
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

      const setorUsuarioNormalizado = normalizarSetorUsuario(usuario.setor || usuario.role || usuario.secao || usuario.cargo);
      const setoresParaBuscar: string[] = ehAdmin ? ["DU", "PA"] : [setorUsuarioNormalizado].filter(Boolean);
      if (setoresParaBuscar.length === 0) return;

      try {
        const usuariosRef = collection(db, "usuarios");
        const todosDocs: { nome: string; setor: string }[] = [];

        for (const setorParaBuscar of setoresParaBuscar) {
          const q = query(usuariosRef, where("setor", "==", setorParaBuscar));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            const data = doc.data() as { ativo?: boolean; nomeGuerra?: string; nome?: string; email?: string; posto?: string; setor?: string };
            if (data.ativo === false) return;
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
        // V2.19 — Preserva o assessor responsável. A própria classificação do board
        // (pendenciasChefia / aguardandoAssinatura / aguardandoResposta) já remove o
        // card da coluna do assessor enquanto a situacaoFluxo estiver ativa. Quando
        // o fluxo avançar, o card volta automaticamente para a coluna de quem é dono.
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

    if (paColunaLabelSet.has(novoResponsavel)) {
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
    const ativos = processosEfetivos.filter((p) => p.status !== "concluido");

    const buscaAtiva = !!busca?.trim();

    // V2.18 — Busca Soberana: ignora filtroTipo e exibe DU + PA simultaneamente,
    // garantindo que o card encontrado nunca "suma" por causa do filtro de setor.
    const tipos: TipoProcesso[] = buscaAtiva
      ? ["DU", "PA"]
      : filtroTipo === "todos" ? ["DU", "PA"] : [filtroTipo as TipoProcesso];

    const result: {
      tipo: TipoProcesso;
      assessores: {
        nome: string;
        itensAtivos: Processo[];
        itensPortariaAssinada: Processo[];
        itensAtrasados: Processo[];
        itensConcluidos: Processo[];
      }[];
    }[] = [];

    // ---- Pré-cálculo O(n): classificações usadas por todos os tipos ----
    // Em vez de filtrar a lista várias vezes (cada filter percorre N processos),
    // percorremos a lista uma única vez e guardamos flags por id em Maps.
    const SITUACOES_PENDENCIA_CHEFIA = new Set([
      "aguardando_assinatura_secao",
      "aguardando_aprovacao_externa",
      "enviado_admin",
      "CHEFIA_DILIGENCIA",
      "CHEFIA_DEFESA",
    ]);

    const tipoPorId = new Map<string, TipoProcesso | string>();
    const tipoPANormPorId = new Map<string, string>();
    const isPendenciaChefiaPorId = new Map<string, boolean>();
    // V2.6 — Roteia cards do estágio AGUARDANDO_ASSINATURA para a coluna própria.
    const isAguardandoAssinaturaPorId = new Map<string, boolean>();
    const isAguardandoRespostaPorId = new Map<string, boolean>();
    const isAguardandoRespostaVencidoPorId = new Map<string, boolean>();
    const isPAAtrasadoPorId = new Map<string, boolean>();
    const colunaPAEmAndamentoPorId = new Map<string, string | null>();
    const colunaPAPortariaAssinadaPorId = new Map<string, string | null>();

    const colunaConselho = paColunaLabelPorId.get("conselho") || null;
    const colunaIPM = paColunaLabelPorId.get("ipm") || null;
    const colunaSindicancia = paColunaLabelPorId.get("sindicancia") || null;

    const classificarPA = (p: Processo, tipoNorm: string): { emAndamento: string | null; portaria: string | null; atrasado: boolean } => {
      const situacaoFluxo = (p.situacaoFluxo || "").toString().trim();
      const emCurso = situacaoFluxo === "EM_CURSO" || situacaoFluxo === "C_EM_CURSO";
      let emAndamento: string | null = null;
      if (emCurso) {
        if (tipoNorm.includes("conselho")) emAndamento = colunaConselho;
        else if (tipoNorm.includes("ipm")) emAndamento = colunaIPM;
        else if (tipoNorm.includes("sindic")) emAndamento = colunaSindicancia;
      }

      let portaria: string | null = null;
      if (situacaoFluxo === "AGUARDANDO_PRAZO" && tipoNorm.includes("sindic")) {
        portaria = colunaSindicancia;
      }

      let atrasado = false;
      if (emCurso) {
        const prazoBase = p.prazoFatal || p.finalPrazo;
        atrasado = !!prazoBase && diasRestantes(prazoBase) < 0;
      }
      return { emAndamento, portaria, atrasado };
    };

    for (const p of processosEfetivos) {
      const tipoCanonico = (p.setor || p.tipo) as TipoProcesso | string;
      tipoPorId.set(p.id, tipoCanonico);

      const situacaoFluxoPedido = p.pedidoSubsidios?.situacaoFluxo || "";
      const statusNorm = (p.status || "").toString().toLowerCase();

      // V2.6 — Identifica cards estacionados em "Aguardando Assinatura".
      const aguardandoAssinatura =
        situacaoFluxoPedido === "AGUARDANDO_ASSINATURA" || statusNorm === "aguardando assinatura";
      isAguardandoAssinaturaPorId.set(p.id, aguardandoAssinatura);

      // V2.6 — Removido statusNorm.includes("aguardando assinatura") para não
      // engolir os cards do novo estágio (que agora têm coluna própria).
      const pendenciaChefia =
        SITUACOES_PENDENCIA_CHEFIA.has(situacaoFluxoPedido)
        || statusNorm.includes("aguardando chem");
      isPendenciaChefiaPorId.set(p.id, pendenciaChefia);

      const aguardandoResposta =
        situacaoFluxoPedido === "AGUARDANDO_RESPOSTA" || statusNorm === "aguardando resposta";
      isAguardandoRespostaPorId.set(p.id, aguardandoResposta);

      if (aguardandoResposta && tipoCanonico === "DU") {
        // V2.23 — Alinha a régua de "vencido" da coluna Aguardando Resposta
        // com o filtro global do dashboard (statusPrazo). Considera vencido
        // quando o prazo de resposta OU o prazo fatal estiverem em overdue;
        // assim, um card sinalizado como "Vencido" no filtro global cai
        // automaticamente na aba "Vencidos" desta coluna.
        const prazoResposta = p.pedidoSubsidios?.prazoResposta;
        const prazoFatal = p.prazoFatal;
        const vencido =
          statusPrazo(prazoResposta) === "overdue"
          || statusPrazo(prazoFatal) === "overdue";
        isAguardandoRespostaVencidoPorId.set(p.id, vencido);
      } else {
        isAguardandoRespostaVencidoPorId.set(p.id, false);
      }

      if (tipoCanonico === "PA") {
        const tipoPANorm = (p.tipoPA || p.subtipo || "")
          .toString()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        tipoPANormPorId.set(p.id, tipoPANorm);

        const { emAndamento, portaria, atrasado } = classificarPA(p, tipoPANorm);
        colunaPAEmAndamentoPorId.set(p.id, emAndamento);
        colunaPAPortariaAssinadaPorId.set(p.id, portaria);
        isPAAtrasadoPorId.set(p.id, atrasado);
      }
    }

    // ---- Distribuição por tipo (apenas lookups O(1)) ----
    for (const tipo of tipos) {
      const doTipo = ativos.filter((p) => tipoPorId.get(p.id) === tipo);
      const concluidosDoTipo = processosEfetivos.filter(
        (p) => tipoPorId.get(p.id) === tipo && p.status === "concluido",
      );

      const considerarPendenciaChefia = tipo === "DU" || ehAdmin;

      // Particiona doTipo em uma única passagem
      const aguardandoRespostaDUAtivos: Processo[] = [];
      const aguardandoRespostaDUVencidos: Processo[] = [];
      // V2.6 — Cards parados em "Aguardando Assinatura" (Vigília SPED).
      const aguardandoAssinaturaDU: Processo[] = [];
      const pendenciasChefia: Processo[] = [];
      const doTipoSemPendenciasChefia: Processo[] = [];

      for (const p of doTipo) {
        const aguardando = isAguardandoRespostaPorId.get(p.id) === true;

        if (tipo === "DU" && aguardando) {
          if (isAguardandoRespostaVencidoPorId.get(p.id)) {
            aguardandoRespostaDUVencidos.push(p);
          } else {
            aguardandoRespostaDUAtivos.push(p);
          }
          continue;
        }

        // V2.6 — Cards do estágio AGUARDANDO_ASSINATURA vão para a coluna nova
        // (estacionamento da Vigília SPED), não para a Mesa do Chefe.
        if (tipo === "DU" && isAguardandoAssinaturaPorId.get(p.id)) {
          aguardandoAssinaturaDU.push(p);
          continue;
        }

        if (considerarPendenciaChefia && isPendenciaChefiaPorId.get(p.id)) {
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

      if (tipo === "PA") {
        paColunaLabels.forEach(garantirChave);
      }

      if (pendenciasChefia.length > 0 || tipo === "DU") {
        garantirChave("MESA DO CHEFE");
        mapAtivos.set("MESA DO CHEFE", pendenciasChefia);
      }

      if (aguardandoRespostaDUAtivos.length > 0 || aguardandoRespostaDUVencidos.length > 0 || tipo === "DU") {
        garantirChave(duColunaAguardandoResposta);
        mapAtivos.set(duColunaAguardandoResposta, aguardandoRespostaDUAtivos);
        mapAtrasados.set(duColunaAguardandoResposta, aguardandoRespostaDUVencidos);
      }

      // V2.6 — Sempre garante a coluna "Aguardando Assinatura" no fluxo DU
      // e popula com os cards estacionados na Vigília SPED.
      if (tipo === "DU") {
        garantirChave(duColunaAguardandoAssinatura);
        mapAtivos.set(duColunaAguardandoAssinatura, aguardandoAssinaturaDU);
      }

      if (tipo === "DU") {
        garantirChave(duColunaAguardandoDistribuicao);
      }

      // Adiciona os processos aos seus responsáveis (lookup O(1) nas Maps)
      doTipoSemPendenciasChefia.forEach((p) => {
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

        // Processos sem responsável vão para "Aguardando Distribuição" (DU) ou são ignorados (PA)
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = tipo === "PA" ? "" : duColunaAguardandoDistribuicao;
        }
        if (!responsavelKey) return;
        garantirChave(responsavelKey);
        mapAtivos.get(responsavelKey)!.push(p);
      });

      concluidosDoTipo.forEach((p) => {
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = tipo === "PA" ? "" : duColunaAguardandoDistribuicao;
        }
        if (!responsavelKey) return;
        garantirChave(responsavelKey);
        mapConcluidos.get(responsavelKey)!.push(p);
      });

      // Adiciona todos os assessores do setor (mesmo sem processos)
      const assessoresDesteTipo = assessoresDoSetor.filter((a) => a.setor === tipo);
      assessoresDesteTipo.forEach((assessor) => garantirChave(assessor.nome));

      // Ordena: "Aguardando Distribuição" primeiro (SE houver processos), depois ordem alfabética
      const nomesAssessores = Array.from(new Set([...mapAtivos.keys(), ...mapConcluidos.keys()]));

      const assessores = nomesAssessores
        .map((nome) => ({
          nome,
          itensAtivos: mapAtivos.get(nome) || [],
          itensPortariaAssinada: mapPortariaAssinada.get(nome) || [],
          itensAtrasados: mapAtrasados.get(nome) || [],
          itensConcluidos: mapConcluidos.get(nome) || [],
        }))
        .filter(({ nome, itensAtivos, itensPortariaAssinada, itensAtrasados, itensConcluidos }) => {
          if (tipo === "DU" && (nome === "MESA DO CHEFE" || nome === duColunaAguardandoAssinatura || nome === duColunaAguardandoResposta || nome === duColunaAguardandoDistribuicao)) {
            return true;
          }
          if (nome.includes("📥 Aguardando") || nome.includes("📩 Aguardando") || nome.includes("✍️ Aguardando")) {
            return itensAtivos.length > 0 || itensPortariaAssinada.length > 0 || itensAtrasados.length > 0 || itensConcluidos.length > 0;
          }
          return true;
        })
        .sort((a, b) => {
          if (a.nome.includes("MESA DO CHEFE")) return -1;
          if (b.nome.includes("MESA DO CHEFE")) return 1;
          const aEhColunaPA = paColunaLabelSet.has(a.nome);
          const bEhColunaPA = paColunaLabelSet.has(b.nome);
          if (aEhColunaPA && !bEhColunaPA) return -1;
          if (!aEhColunaPA && bEhColunaPA) return 1;
          if (aEhColunaPA && bEhColunaPA) {
            return paColunaLabels.indexOf(a.nome) - paColunaLabels.indexOf(b.nome);
          }
          // V2.6 — Ordem estrita das colunas fixas DU.
          if (a.nome === duColunaAguardandoAssinatura) return -1;
          if (b.nome === duColunaAguardandoAssinatura) return 1;
          if (a.nome === duColunaAguardandoResposta) return -1;
          if (b.nome === duColunaAguardandoResposta) return 1;
          if (a.nome === duColunaAguardandoDistribuicao) return -1;
          if (b.nome === duColunaAguardandoDistribuicao) return 1;
          return a.nome.localeCompare(b.nome);
        });

      if (assessores.length > 0) {
        result.push({ tipo, assessores });
      }
    }

    return result;
  }, [processosEfetivos, filtroTipo, assessoresDoSetor, paColunaLabelPorId, paColunaLabelSet, paColunaLabels, ehAdmin, duColunaAguardandoResposta, duColunaAguardandoAssinatura, duColunaAguardandoDistribuicao, busca]);

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
          const isDUDuasLinhas = grupo.tipo === "DU";
          const colunasPAEmAndamento = grupo.tipo === "PA"
            ? grupo.assessores.filter((a) => paColunaLabelSet.has(a.nome))
            : [];
          const colunasPAAssessores = grupo.tipo === "PA"
            ? grupo.assessores.filter((a) => !paColunaLabelSet.has(a.nome))
            : grupo.assessores;
          const colunasDUFixas = isDUDuasLinhas
            ? grupo.assessores
                .filter((a) => (
                  a.nome === "MESA DO CHEFE"
                  || a.nome === duColunaAguardandoAssinatura
                  || a.nome === duColunaAguardandoResposta
                  || a.nome === duColunaAguardandoDistribuicao
                ))
                // V2.6 — Ordem estrita: Chefe → Assinatura → Resposta → Distribuição.
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
                })
            : [];
          const colunasDUAssessores = isDUDuasLinhas
            ? grupo.assessores.filter(
                (a) =>
                  a.nome !== "MESA DO CHEFE"
                  && a.nome !== duColunaAguardandoAssinatura
                  && a.nome !== duColunaAguardandoResposta
                  && a.nome !== duColunaAguardandoDistribuicao,
              )
            : [];
          const colunasDUEsperaDistribuicao = isDUDuasLinhas
            ? []
            : [];
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
              {grupo.tipo === "PA" ? (
                <div className="space-y-4">
                  <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
                    {colunasPAEmAndamento.map((a) => (
                      <AssessorGroup
                        key={`${grupo.tipo}-${a.nome}`}
                        responsavel={a.nome}
                        tipo={grupo.tipo}
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
                        isWide={a.nome === paColunaLabelPorId.get("sindicancia")}
                      />
                    ))}
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
                    {colunasPAAssessores.map((a) => (
                      <AssessorGroup
                        key={`${grupo.tipo}-${a.nome}`}
                        responsavel={a.nome}
                        tipo={grupo.tipo}
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
                      />
                    ))}
                  </div>
                </div>
              ) : isDUDuasLinhas ? (
                <div className="space-y-4">
                  <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
                    {colunasDUFixas.map((a) => (
                      <AssessorGroup
                        key={`${grupo.tipo}-fixa-${a.nome}`}
                        responsavel={a.nome}
                        tipo={grupo.tipo}
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
                      />
                    ))}
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
                    {[...colunasDUAssessores, ...colunasDUEsperaDistribuicao].map((a) => (
                      <AssessorGroup
                        key={`${grupo.tipo}-assessor-${a.nome}`}
                        responsavel={a.nome}
                        tipo={grupo.tipo}
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
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none scrollbar-thin">
                  {grupo.assessores.map((a) => (
                    <AssessorGroup
                      key={`${grupo.tipo}-${a.nome}`}
                      responsavel={a.nome}
                      tipo={grupo.tipo}
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
                    />
                  ))}
                </div>
              )}
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
              naoLido={!!(activeProcesso && unreadProcessIds?.has(activeProcesso.id))}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
