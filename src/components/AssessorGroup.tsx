import { ProcessoCard } from "./ProcessoCard";
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
}

export function AssessorGroup({ responsavel, tipo, processos, processosPortariaAssinada = [], processosAtrasados = [], processosConcluidos = [], ehAdmin, onEdit, onDelete, onMove, onReativarProcesso, siteSettings, unreadProcessIds, onReadProcess, isWide = false, filtro }: Props) {
  const [aba, setAba] = useState<"portaria_assinada" | "andamento" | "atraso" | "concluidos">("andamento");

  useEffect(() => {
    if (filtro === "vencidos") {
      setAba("atraso");
    } else if (filtro === "hoje" || filtro === "semana" || filtro === "todos") {
      setAba("andamento");
    }
  }, [filtro]);
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

  const mostrarAbaPortariaAssinada = tipo === "PA" && responsavel.trim() === labelSindicanciaPA.trim();

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
    if (isAguardandoRespostaDU) {
      return [
        { id: "andamento", scope: "DU", label: "No Prazo", order: 1, enabled: true },
        { id: "atraso", scope: "DU", label: "Vencidos", order: 2, enabled: true },
        { id: "concluidos", scope: "DU", label: "Concluídos", order: 3, enabled: true },
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
  }, [isAguardandoRespostaDU, mostrarAbaPortariaAssinada, siteSettings?.columnTabs, tipo]);

  const abaAtiva = useMemo(() => {
    const existe = abasConfiguradas.some((item) => item.id === aba);
    return existe ? aba : abasConfiguradas[0]?.id || "andamento";
  }, [aba, abasConfiguradas]);

  const processosDaAbaAtiva = abaAtiva === "portaria_assinada"
    ? processosPortariaAssinada
    : abaAtiva === "andamento"
      ? processosAtivosOrdenados
      : abaAtiva === "atraso"
        ? processosAtrasadosOrdenados
        : processosConcluidos;

  return (
    <div 
      ref={setNodeRef}
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
            const count = tab.id === "andamento"
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
                : "Sem processos concluídos"}
          </div>
        ) : (
          processosDaAbaAtiva.map((p) => (
            <ProcessoCard
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
            />
          ))
        )}
      </div>
    </div>
  );
}
