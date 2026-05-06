import { CardDU } from "./CardDU";
import { CardPA } from "./CardPA";
import type { Processo, StatusProcesso, TipoProcesso, FiltroPrazo } from "@/types/processo";
import { DEFAULT_COLUMN_TABS, DEFAULT_PA_EM_ANDAMENTO_COLUMNS, normalizarPAEmAndamentoColumns } from "@/types/siteSettings";
import type { SiteSettings } from "@/types/siteSettings";
import { useDroppable } from "@dnd-kit/core";
import { useEffect, useMemo, useState } from "react";

interface Props {
  responsavel: string;
  tipo: TipoProcesso;
  processos: Processo[];
  processosPortariaAssinada?: Processo[];
  processosAtrasados?: Processo[];
  processosConcluidos?: Processo[];
  ehAdmin?: boolean;
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  siteSettings?: SiteSettings;
  unreadProcessIds?: Set<string>;
  onReadProcess?: (processoId: string) => void;
  /** Quando `true`, a coluna usa largura ampliada (450px) em telas ≥sm. */
  isWide?: boolean;
  filtro?: FiltroPrazo;
  busca?: string;
  mapaCoresAssessores?: Record<string, string>;
  /**
   * V5.3 — Quando `true`, a coluna assume a visão exclusiva da Mesa do
   * Assessor: apenas duas abas ("Em Andamento" e "Concluídos"), com a aba
   * "Em Andamento" englobando ativos + atrasados + portarias assinadas.
   */
  vistaAssessor?: boolean;
}

export function AssessorGroup({ responsavel, tipo, processos, processosPortariaAssinada = [], processosAtrasados = [], processosConcluidos = [], ehAdmin, onEdit, onDelete, onMove, onReativarProcesso, siteSettings, unreadProcessIds, onReadProcess, isWide = false, filtro, busca, mapaCoresAssessores = {}, vistaAssessor = false }: Props) {
  const [aba, setAba] = useState<"portaria_assinada" | "andamento" | "atraso" | "concluidos">("andamento");
  const corColuna = mapaCoresAssessores[(responsavel || "").trim()];

  useEffect(() => {
    if (filtro === "vencidos") {
      setAba("atraso");
    } else if (filtro === "hoje" || filtro === "semana" || filtro === "todos") {
      setAba("andamento");
    }
  }, [filtro]);

  // V2.18 — Quando há busca ativa, salta automaticamente para a primeira aba
  // que possui resultados, evitando que o card encontrado fique escondido.
  useEffect(() => {
    if (!busca?.trim()) return;
    if (processos.length > 0) {
      setAba("andamento");
    } else if (processosAtrasados.length > 0) {
      setAba("atraso");
    } else if (processosPortariaAssinada.length > 0) {
      setAba("portaria_assinada");
    } else if (processosConcluidos.length > 0) {
      setAba("concluidos");
    }
  }, [busca, processos.length, processosAtrasados.length, processosPortariaAssinada.length, processosConcluidos.length]);
  const { setNodeRef, isOver } = useDroppable({
    id: responsavel, // ID único para esta coluna (nome do assessor)
  });

  const isDU = tipo === "DU";
  const isAguardandoDistribuicao = responsavel.includes("📥 Aguardando");
  const isAguardandoRespostaDU = isDU && responsavel.toLowerCase().includes("aguardando resposta");
  
  const tipoBg = isDU ? "bg-[var(--tipo-du-bg)]" : "bg-[var(--tipo-pa-bg)]";
  const tipoText = isDU ? "text-[var(--tipo-du)]" : "text-[var(--tipo-pa)]";
  const tipoBorder = isDU ? "border-[var(--tipo-du)]/30" : "border-[var(--tipo-pa)]/30";
  
  // Se é "Aguardando Distribuição", usa cor laranja destacada
  const bgClass = isAguardandoDistribuicao ? "bg-orange-50" : tipoBg;
  const textClass = isAguardandoDistribuicao ? "text-orange-700" : tipoText;
  const borderClass = isAguardandoDistribuicao ? "border-orange-300" : tipoBorder;

  const labelSindicanciaPA = useMemo(() => {
    const colunas = normalizarPAEmAndamentoColumns(
      siteSettings?.paEmAndamentoColumns,
      DEFAULT_PA_EM_ANDAMENTO_COLUMNS,
    );
    return colunas.find((coluna) => coluna.id === "sindicancia")?.label || "📗 Sindicancias";
  }, [siteSettings?.paEmAndamentoColumns]);

  // V5.2 — Aba "Portaria Assinada" agora vale para todas as colunas PA
  // (Sindicância, IPM, Conselho, Investigação Preliminar e colunas de assessores).
  // V5.3 — Na visão exclusiva do Assessor (`vistaAssessor`), a aba
  // "Portaria Assinada" é ocultada.
  void labelSindicanciaPA;
  const mostrarAbaPortariaAssinada = tipo === "PA" && !vistaAssessor;

  const processosAtivosOrdenados = useMemo(() => {
    if (tipo !== "PA") return processos;

    const toTime = (valor?: string) => {
      if (!valor) return Number.POSITIVE_INFINITY;
      const data = new Date(`${valor.slice(0, 10)}T00:00:00`).getTime();
      return Number.isNaN(data) ? Number.POSITIVE_INFINITY : data;
    };

    return [...processos].sort((a, b) => {
      const prazoA = toTime(a.prazoFatal || a.finalPrazo);
      const prazoB = toTime(b.prazoFatal || b.finalPrazo);

      if (prazoA !== prazoB) return prazoA - prazoB;

      const inicioA = toTime(a.dataInicioPrazo || a.inicioPrazo);
      const inicioB = toTime(b.dataInicioPrazo || b.inicioPrazo);
      if (inicioA !== inicioB) return inicioA - inicioB;

      return (a.numero || "").localeCompare(b.numero || "");
    });
  }, [processos, tipo]);

  const processosAtrasadosOrdenados = useMemo(() => {
    if (tipo !== "PA") return processosAtrasados;

    const toTime = (valor?: string) => {
      if (!valor) return Number.POSITIVE_INFINITY;
      const data = new Date(`${valor.slice(0, 10)}T00:00:00`).getTime();
      return Number.isNaN(data) ? Number.POSITIVE_INFINITY : data;
    };

    return [...processosAtrasados].sort((a, b) => {
      const prazoA = toTime(a.prazoFatal || a.finalPrazo);
      const prazoB = toTime(b.prazoFatal || b.finalPrazo);
      if (prazoA !== prazoB) return prazoA - prazoB;
      return (a.numero || "").localeCompare(b.numero || "");
    });
  }, [processosAtrasados, tipo]);

  const processosDaAba = aba === "portaria_assinada"
    ? processosPortariaAssinada
    : aba === "andamento"
      ? processosAtivosOrdenados
      : aba === "atraso"
        ? processosAtrasadosOrdenados
        : processosConcluidos;

  const abasConfiguradas = useMemo(() => {
    if (vistaAssessor) {
      // V5.3 — Mesa do Assessor: apenas "Em Andamento" e "Concluídos".
      return [
        { id: "andamento", scope: "PA", label: "Em Andamento", order: 1, enabled: true },
        { id: "concluidos", scope: "PA", label: "Concluídos", order: 2, enabled: true },
      ];
    }

    if (isAguardandoRespostaDU) {
      return [
        { id: "andamento", scope: "DU", label: "No Prazo", order: 1, enabled: true },
        { id: "atraso", scope: "DU", label: "Vencidos", order: 2, enabled: true },
        { id: "concluidos", scope: "DU", label: "Finalizados", order: 3, enabled: true },
      ];
    }

    const scope = tipo === "PA" ? "PA" : "DU";
    const base = siteSettings?.columnTabs?.length
      ? siteSettings.columnTabs
      : DEFAULT_COLUMN_TABS;

    const lista = base
      .filter((item) => item.scope === scope)
      .filter((item) => item.id !== "portaria_assinada" || mostrarAbaPortariaAssinada)
      .filter((item) => item.enabled !== false)
      .sort((a, b) => a.order - b.order)
      .map((item) => ({
        ...item,
        label: String(item.label || "").trim() || item.id,
      }));

    const fallback = DEFAULT_COLUMN_TABS
      .filter((item) => item.scope === scope)
      .filter((item) => item.id !== "portaria_assinada" || mostrarAbaPortariaAssinada)
      .sort((a, b) => a.order - b.order);

    return lista.length > 0 ? lista : fallback;
  }, [isAguardandoRespostaDU, mostrarAbaPortariaAssinada, siteSettings?.columnTabs, tipo, vistaAssessor]);

  const abaAtiva = useMemo(() => {
    const existe = abasConfiguradas.some((item) => item.id === aba);
    return existe ? aba : abasConfiguradas[0]?.id || "andamento";
  }, [aba, abasConfiguradas]);

  const isVisaoAssessorPA = vistaAssessor && tipo === "PA";

  const normalizarSituacao = (valor: unknown) =>
    String(valor || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const ehConcluidoPA = (p: Processo) => {
    const st = String(p.status || "").trim().toLowerCase();
    return p.finalizado === true || st === "concluido" || st === "concluído";
  };

  const isNaMesaDoAssessorPA = (processo: Processo) => {
    const stNorm = String(processo.status || "").trim().toLowerCase();
    const isProcessoAtivo =
      processo.setor === "PA" &&
      processo.finalizado !== true &&
      stNorm !== "concluido" &&
      stNorm !== "concluído";

    if (!isProcessoAtivo) return false;

    if (isVisaoAssessorPA) {
      const sitPA = normalizarSituacao(processo.situacaoFluxoPA);
      const sitConselho = normalizarSituacao(processo.situacaoFluxoConselho);
      const sitLegado = normalizarSituacao(processo.situacaoFluxo);
      const emFaseAssessorSolucao =
        sitPA === "FAZENDO_SOLUCAO" ||
        sitPA === "ASSINANDO_SOLUCAO";

      const isComEncarregado =
        sitPA === "COM_ENCARREGADO" ||
        sitPA === "ASSINANDO_PORTARIA" ||
        sitPA === "AGUARDANDO_ENTREGA" ||
        sitPA === "AGUARDANDO_PRAZO" ||
        sitConselho === "COM_CONSELHO" ||
        sitLegado === "EM_CURSO" ||
        sitLegado === "C_EM_CURSO" ||
        sitLegado === "AGUARDANDO_PRAZO";

      // Fallback para bases legadas/inconsistentes:
      // se já existe encarregado e há sinal de prazo correndo (início/prorrogação),
      // o processo deve sair da mesa individual.
      const possuiEncarregado = String(processo.encarregado || "").trim().length > 0;
      const prazoJaIniciado = !!(processo.dataInicioPrazo || processo.inicioPrazo);
      const temProrrogacao = Array.isArray(processo.prorrogacoes) && processo.prorrogacoes.length > 0;
      const isComEncarregadoInferido = !emFaseAssessorSolucao && possuiEncarregado && (prazoJaIniciado || temProrrogacao);

      const pertenceAoAssessor = String(processo.responsavel || "").trim() === String(responsavel || "").trim();

      return pertenceAoAssessor && !isComEncarregado && !isComEncarregadoInferido;
    }

    return isProcessoAtivo;
  };

  const processosDaAbaAtiva = (() => {
    if (!vistaAssessor) {
      if (abaAtiva === "portaria_assinada") return processosPortariaAssinada;
      if (abaAtiva === "andamento") return processosAtivosOrdenados;
      if (abaAtiva === "atraso") return processosAtrasadosOrdenados;
      return processosConcluidos;
    }

    const universo = [
      ...processos,
      ...processosAtrasados,
      ...processosPortariaAssinada,
      ...processosConcluidos,
    ];
    
    const dedup = new Map<string, Processo>();
    for (const p of universo) {
      if (p && p.id && !dedup.has(p.id)) dedup.set(p.id, p);
    }
    const lista = Array.from(dedup.values());

    if (abaAtiva === "concluidos") {
      return lista.filter((p) => ehConcluidoPA(p) && String(p.responsavel || "").trim() === String(responsavel || "").trim());
    }

    return lista.filter(isNaMesaDoAssessorPA);
  })();

  const CardComponente = tipo === "DU" ? CardDU : CardPA;

  return (
    <div 
      ref={setNodeRef}
      style={corColuna ? { borderTopColor: corColuna, borderTopWidth: "4px" } : undefined}
      className={`shrink-0 w-[88vw] ${isWide ? "sm:w-[450px]" : "sm:w-[340px]"} snap-start flex flex-col rounded-3xl bg-card border shadow-card overflow-hidden transition-all ${
        isOver ? "border-blue-500 border-2 ring-2 ring-blue-200 scale-[1.02]" : "border-border"
      }`}
    >
      {/* Header do assessor */}
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-bold tracking-wide border ${bgClass} ${textClass} ${borderClass}`}
          >
            {tipo} · {responsavel}
          </span>
        </div>

        <div className="rounded-xl bg-muted p-1 gap-1 grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, abasConfiguradas.length)}, minmax(0, 1fr))` }}>
          {abasConfiguradas.map((tab) => {
            const count = vistaAssessor
              ? (() => {
                  const universo = [...processos, ...processosAtrasados, ...processosPortariaAssinada, ...processosConcluidos];
                  const dedup = Array.from(new Map(universo.filter(p => p?.id).map(p => [p.id, p])).values());
                  if (tab.id === "concluidos") {
                    return dedup.filter(p => ehConcluidoPA(p) && String(p.responsavel || "").trim() === String(responsavel || "").trim()).length;
                  }
                  return dedup.filter(isNaMesaDoAssessorPA).length;
                })()
              : tab.id === "andamento"
                ? processos.length
                : tab.id === "portaria_assinada"
                  ? processosPortariaAssinada.length
                : tab.id === "atraso"
                  ? processosAtrasados.length
                  : processosConcluidos.length;

            return (
              <button
                key={`${responsavel}-${tab.id}`}
                type="button"
                onClick={() => setAba(tab.id as "portaria_assinada" | "andamento" | "atraso" | "concluidos")}
                className={`min-h-[52px] px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors leading-tight ${
                  abaAtiva === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="block">{tab.label}</span>
                <span className="block mt-1 text-[11px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 p-3 space-y-2.5 min-h-[140px] max-h-[calc(100vh-22rem)] overflow-y-auto scrollbar-thin">
        {processosDaAbaAtiva.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border py-10 text-center text-xs text-muted-foreground/60 font-semibold">
            {abaAtiva === "andamento"
              ? "Sem processos no prazo"
              : abaAtiva === "portaria_assinada"
                ? "Sem portarias assinadas"
              : abaAtiva === "atraso"
                ? isAguardandoRespostaDU
                  ? "Sem processos vencidos"
                  : "Sem processos em atraso"
                : "Sem processos finalizados"}
          </div>
        ) : (
          processosDaAbaAtiva.map((p) => (
            <CardComponente
              key={p.id}
              processo={p}
              ehAdmin={ehAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
              onReativarProcesso={onReativarProcesso}
              siteSettings={siteSettings}
              showActions
              naoLido={!!unreadProcessIds?.has(p.id)}
              onMarcarComoLido={onReadProcess}
              corDestaque={mapaCoresAssessores[(p.responsavel || "").trim()]}
            />
          ))
        )}
      </div>
    </div>
  );
}
