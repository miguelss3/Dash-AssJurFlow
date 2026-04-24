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
import { DEFAULT_DU_BOARD_COLUMNS, DEFAULT_PA_EM_ANDAMENTO_COLUMNS, type SiteSettings } from "@/types/siteSettings";
import { normalizarSetorUsuario } from "@/lib/userProfiles";
import { diasRestantes } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  filtroTipo: "todos" | "DU" | "PA";
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  onRedistribuir?: (processoId: string, novoResponsavel: string) => void | Promise<void>;
  usuario?: AuthUser;
  ehAdmin?: boolean;
  unreadProcessIds?: Set<string>;
  onReadProcess?: (processoId: string) => void;
  siteSettings?: SiteSettings;
}

export function MesaTrabalho({ processos, filtroTipo, onEdit, onDelete, onMove, onReativarProcesso, onRedistribuir, usuario, ehAdmin, unreadProcessIds, onReadProcess, siteSettings }: Props) {
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
            const data = doc.data() as Record<string, any>;
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
    if (
      novoResponsavel === "MESA DO CHEFE"
      || novoResponsavel === duColunaAguardandoResposta
      || paColunaLabelSet.has(novoResponsavel)
    ) {
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
      assessores: { nome: string; itensAtivos: Processo[]; itensAtrasados: Processo[]; itensConcluidos: Processo[] }[];
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
        return [
          "aguardando_assinatura_secao",
          "aguardando_aprovacao_externa",
          "enviado_admin",
          "CHEFIA_DILIGENCIA",
          "CHEFIA_DEFESA",
        ].includes(situacaoFluxo)
          || statusNorm.includes("aguardando assinatura")
          || statusNorm.includes("aguardando chem");
      };

      const isAguardandoResposta = (p: Processo) => {
        const situacaoFluxo = p.pedidoSubsidios?.situacaoFluxo || "";
        const statusNorm = (p.status || "").toString().toLowerCase();
        return situacaoFluxo === "AGUARDANDO_RESPOSTA" || statusNorm === "aguardando resposta";
      };

      const colunaPAEmAndamento = (p: Processo) => {
        if (tipo !== "PA") return null;

        const situacaoFluxo = (p.situacaoFluxo || "").toString().trim();
        if (situacaoFluxo !== "EM_CURSO" && situacaoFluxo !== "C_EM_CURSO") {
          return null;
        }

        const tipoPANormalizado = (p.tipoPA || p.subtipo || "")
          .toString()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();

        if (tipoPANormalizado.includes("conselho")) return paColunaLabelPorId.get("conselho") || null;
        if (tipoPANormalizado.includes("ipm")) return paColunaLabelPorId.get("ipm") || null;
        if (tipoPANormalizado.includes("sindic")) return paColunaLabelPorId.get("sindicancia") || null;
        return null;
      };

      const isPAAtrasado = (p: Processo) => {
        if (tipo !== "PA") return false;
        const situacaoFluxo = (p.situacaoFluxo || "").toString().trim();
        if (situacaoFluxo !== "EM_CURSO" && situacaoFluxo !== "C_EM_CURSO") return false;
        const prazoBase = p.prazoFatal || p.finalPrazo;
        return !!prazoBase && diasRestantes(prazoBase) < 0;
      };

      const aguardandoRespostaDU = tipo === "DU" ? doTipo.filter(isAguardandoResposta) : [];
      const pendenciasChefia = ehAdmin ? doTipo.filter((p) => isPendenteChefia(p) && (tipo !== "DU" || !isAguardandoResposta(p))) : [];
      const doTipoSemPendenciasChefia = ehAdmin
        ? doTipo.filter((p) => !isPendenteChefia(p) && (tipo !== "DU" || !isAguardandoResposta(p)))
        : (tipo === "DU" ? doTipo.filter((p) => !isAguardandoResposta(p)) : doTipo);
      
      const mapAtivos = new Map<string, Processo[]>();
      const mapAtrasados = new Map<string, Processo[]>();
      const mapConcluidos = new Map<string, Processo[]>();

      if (tipo === "PA") {
        paColunaLabels.forEach((coluna) => {
          mapAtivos.set(coluna, []);
          mapAtrasados.set(coluna, []);
          mapConcluidos.set(coluna, []);
        });
      }

      if (pendenciasChefia.length > 0 || tipo === "DU") {
        mapAtivos.set("MESA DO CHEFE", pendenciasChefia);
        if (!mapAtrasados.has("MESA DO CHEFE")) mapAtrasados.set("MESA DO CHEFE", []);
        if (!mapConcluidos.has("MESA DO CHEFE")) mapConcluidos.set("MESA DO CHEFE", []);
      }

      if (aguardandoRespostaDU.length > 0 || tipo === "DU") {
        mapAtivos.set(duColunaAguardandoResposta, aguardandoRespostaDU);
        if (!mapAtrasados.has(duColunaAguardandoResposta)) mapAtrasados.set(duColunaAguardandoResposta, []);
        if (!mapConcluidos.has(duColunaAguardandoResposta)) mapConcluidos.set(duColunaAguardandoResposta, []);
      }
      
      // Adiciona os processos aos seus responsáveis
      doTipoSemPendenciasChefia.forEach((p) => {
        const colunaEspecialPA = colunaPAEmAndamento(p);
        if (colunaEspecialPA) {
          if (isPAAtrasado(p)) {
            mapAtrasados.get(colunaEspecialPA)!.push(p);
          } else {
            mapAtivos.get(colunaEspecialPA)!.push(p);
          }
          return;
        }

        // Processos sem responsável ou com "Sem responsável" vão para "Aguardando Distribuição"
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = tipo === "PA" ? "" : duColunaAguardandoDistribuicao;
        }
        if (!responsavelKey) return;
        if (!mapAtivos.has(responsavelKey)) mapAtivos.set(responsavelKey, []);
        mapAtivos.get(responsavelKey)!.push(p);
        if (!mapAtrasados.has(responsavelKey)) mapAtrasados.set(responsavelKey, []);
      });

      concluidosDoTipo.forEach((p) => {
        let responsavelKey = p.responsavel || "";
        if (!responsavelKey || responsavelKey === "Sem responsável" || responsavelKey.trim() === "") {
          responsavelKey = tipo === "PA" ? "" : duColunaAguardandoDistribuicao;
        }
        if (!responsavelKey) return;
        if (!mapConcluidos.has(responsavelKey)) mapConcluidos.set(responsavelKey, []);
        mapConcluidos.get(responsavelKey)!.push(p);
      });
      
      // Adiciona todos os assessores do setor (mesmo sem processos)
      const assessoresDesteTipo = assessoresDoSetor.filter(a => a.setor === tipo);
      assessoresDesteTipo.forEach(assessor => {
        if (!mapAtivos.has(assessor.nome)) {
          mapAtivos.set(assessor.nome, []); // Coluna vazia
        }
        if (!mapAtrasados.has(assessor.nome)) {
          mapAtrasados.set(assessor.nome, []);
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
          itensAtrasados: mapAtrasados.get(nome) || [],
          itensConcluidos: mapConcluidos.get(nome) || [],
        }))
        .filter(({ nome, itensAtivos, itensAtrasados, itensConcluidos }) => {
          // Só mostra "Aguardando Distribuição" e colunas especiais se tiver processos
          if (tipo === "DU" && (nome === "MESA DO CHEFE" || nome === duColunaAguardandoResposta)) {
            return true;
          }
          if (nome.includes("📥 Aguardando") || nome.includes("📩 Aguardando")) {
            return itensAtivos.length > 0 || itensAtrasados.length > 0 || itensConcluidos.length > 0;
          }
          return true; // Outros assessores sempre aparecem
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
    
    // console.log("📊 Resultado final:", result);
    return result;
  }, [processosEfetivos, filtroTipo, assessoresDoSetor, paColunaLabelPorId, paColunaLabelSet, paColunaLabels, ehAdmin, duColunaAguardandoResposta, duColunaAguardandoDistribuicao]);

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
                .filter((a) => a.nome === "MESA DO CHEFE" || a.nome === duColunaAguardandoResposta)
                .sort((a, b) => {
                  if (a.nome === "MESA DO CHEFE") return -1;
                  if (b.nome === "MESA DO CHEFE") return 1;
                  return 0;
                })
            : [];
          const colunasDUAssessores = isDUDuasLinhas
            ? grupo.assessores.filter(
                (a) =>
                  a.nome !== "MESA DO CHEFE"
                  && a.nome !== duColunaAguardandoResposta
                  && a.nome !== duColunaAguardandoDistribuicao,
              )
            : [];
          const colunasDUEsperaDistribuicao = isDUDuasLinhas
            ? grupo.assessores.filter((a) => a.nome === duColunaAguardandoDistribuicao)
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
