import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DEFAULT_PROCESSUAL_DEADLINES,
  type ProcessualDeadlineSettings,
} from "@/types/siteSettings";

export type StatusPrazo = "overdue" | "today" | "soon" | "safe";

/**
 * Aceita qualquer formato de data vindo do Firestore ou da aplicação:
 *  - Date instance
 *  - Firestore Timestamp (com `.toDate()`)
 *  - { seconds, nanoseconds } (Timestamp serializado)
 *  - String ISO completa (`2026-04-29T13:00:00.000Z`)
 *  - String somente data (`2026-04-29`) — interpretada como meia-noite LOCAL
 *    para não sofrer deslocamento em fusos negativos (ex.: Manaus UTC-4),
 *    o que provocaria "hoje" virar "ontem".
 * Retorna `null` se não conseguir converter.
 */
export function toDateLocal(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "object") {
  const v = value as { toDate?: () => Date; seconds?: number };
    if (typeof v.toDate === "function") {
      try {
        const d = v.toDate();
        return Number.isNaN(d.getTime()) ? null : d;
      } catch {
        /* tenta seconds */
      }
    }
    if (typeof v.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  if (typeof value === "string") {
    const texto = value.trim();
    if (!texto) return null;
    const apenasData = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (apenasData) {
      const d = new Date(
        Number(apenasData[1]),
        Number(apenasData[2]) - 1,
        Number(apenasData[3]),
        0, 0, 0, 0,
      );
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(texto);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

type ProrrogacaoPA = {
  dias?: number | null;
  inicio?: string | null;
  fim?: string | null;
} | null | undefined;

const PADRAO_HISTORICO_INICIO_PRAZO_PA = /^Prazo do PA iniciado em .*\.$/i;

export function ehConselhoPA(tipoPA: string | undefined | null): boolean {
  return tipoPA === "Conselho de Disciplina" || tipoPA === "Conselho de Justificação";
}

// ---------------------------------------------------------------------------
// V9.4 — Contrato de Integridade de Prazos (PA)
// Hierarquia oficial de leitura do prazo fatal para Processos Administrativos:
//   1º  prazoFatalOverride  (definido manualmente pelo assessor/cadastro)
//   2º  prazoFatal          (valor corrente — pode ter sido calculado por motor)
//   3º  finalPrazo          (campo legado, mantido por compatibilidade)
// Toda UI/cálculo que precise do prazo efetivo de um PA DEVE usar este helper
// em vez de ler o campo bruto, garantindo que ediç ões manuais não sejam
// silenciosamente sobrescritas por recálculos automáticos.
// ---------------------------------------------------------------------------
export function prazoEfetivoPA(processo: {
  prazoFatalOverride?: unknown;
  prazoFatal?: unknown;
  finalPrazo?: unknown;
} | null | undefined): unknown {
  if (!processo) return null;
  return processo.prazoFatalOverride || processo.prazoFatal || processo.finalPrazo || null;
}


function obterConfiguracaoPrazosProcessuais(
  configuracao?: Partial<ProcessualDeadlineSettings> | null,
): ProcessualDeadlineSettings {
  return {
    ...DEFAULT_PROCESSUAL_DEADLINES,
    ...(configuracao || {}),
  };
}

export function obterRegraPrazoPA(tipoPA: string | undefined | null): {
  diasIniciais: number;
  diasProrrogacao: number;
}
export function obterRegraPrazoPA(
  tipoPA: string | undefined | null,
  configuracao: Partial<ProcessualDeadlineSettings> | null | undefined,
): {
  diasIniciais: number;
  diasProrrogacao: number;
}
export function obterRegraPrazoPA(
  tipoPA: string | undefined | null,
  configuracao?: Partial<ProcessualDeadlineSettings> | null,
): {
  diasIniciais: number;
  diasProrrogacao: number;
} {
  const regras = obterConfiguracaoPrazosProcessuais(configuracao);

  if (tipoPA === "IPM") {
    return {
      diasIniciais: regras.prazoIPMInicialDias,
      diasProrrogacao: regras.prazoIPMProrrogacaoDias,
    };
  }

  if (tipoPA === "Sindicância" || tipoPA === "Sindicancia") {
    return {
      diasIniciais: regras.prazoSindicanciaInicialDias,
      diasProrrogacao: regras.prazoSindicanciaProrrogacaoDias,
    };
  }

  return {
    diasIniciais: regras.prazoConselhoInicialDias,
    diasProrrogacao: regras.prazoConselhoProrrogacaoDias,
  };
}

function normalizarDataPrazoPA(valor: string | undefined | null): string | undefined {
  if (!valor) return undefined;

  const texto = String(valor).trim();
  if (!texto) return undefined;
  const prefixoData = texto.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (prefixoData) return prefixoData;

  try {
    const data = parseISO(texto);
    if (Number.isNaN(data.getTime())) return undefined;
    return format(data, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

function adicionarDiasDataCivil(dataISO: string, dias: number): string | undefined {
  try {
    const data = parseISO(`${dataISO}T00:00:00`);
    if (Number.isNaN(data.getTime())) return undefined;
    data.setDate(data.getDate() + dias);
    return format(data, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

function diferencaDiasDataCivil(inicioISO: string, fimISO: string): number | undefined {
  try {
    const inicio = parseISO(`${inicioISO}T00:00:00`);
    const fim = parseISO(`${fimISO}T00:00:00`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return undefined;
    return differenceInCalendarDays(fim, inicio);
  } catch {
    return undefined;
  }
}

export function calcularFaixasProrrogacaoPA(params: {
  tipoPA?: string | null;
  dataInicioPrazo?: string | null;
  dataAssinatura?: string | null;
  prorrogacoes?: ProrrogacaoPA[] | null;
}, configuracao?: Partial<ProcessualDeadlineSettings> | null): Array<{
  dias: number;
  inicio: string;
  fim: string;
}> {
  const { tipoPA, dataInicioPrazo, dataAssinatura, prorrogacoes } = params;
  const dataBase =
    normalizarDataPrazoPA(dataInicioPrazo)
    || (ehConselhoPA(tipoPA) ? normalizarDataPrazoPA(dataAssinatura) : undefined);

  if (!dataBase) return [];

  const { diasIniciais, diasProrrogacao } = obterRegraPrazoPA(tipoPA, configuracao);
  const prazoInicialFim = adicionarDiasDataCivil(dataBase, diasIniciais - 1);
  if (!prazoInicialFim) return [];

  let fimAnterior = prazoInicialFim;
  const itens = Array.isArray(prorrogacoes) ? prorrogacoes : [];

  return itens.reduce<Array<{ dias: number; inicio: string; fim: string }>>((acc, item) => {
    const diasInformados = item?.dias;
    const diasPadrao = typeof diasInformados === "number" && Number.isFinite(diasInformados)
      ? diasInformados
      : diasProrrogacao;

    const inicioInformado = normalizarDataPrazoPA(item?.inicio || undefined);
    const fimInformado = normalizarDataPrazoPA(item?.fim || undefined);

    const inicio = inicioInformado || fimAnterior;
    let fim = fimInformado || adicionarDiasDataCivil(inicio, diasPadrao) || inicio;

    let dias = diasPadrao;
    const diasPeloIntervalo = diferencaDiasDataCivil(inicio, fim);
    if (typeof diasPeloIntervalo === "number" && daysPeloIntervaloValido(diasPeloIntervalo)) {
      dias = diasPeloIntervalo;
    } else {
      fim = adicionarDiasDataCivil(inicio, dias) || fim;
    }

    fimAnterior = fim;
    acc.push({ dias, inicio, fim });
    return acc;
  }, []);
}

function daysPeloIntervaloValido(valor: number): boolean {
  return Number.isFinite(valor) && valor >= 0;
}

export function calcularPrazoFinalPA(params: {
  tipoPA?: string | null;
  dataInicioPrazo?: string | null;
  dataAssinatura?: string | null;
  prorrogacoes?: ProrrogacaoPA[] | null;
}, configuracao?: Partial<ProcessualDeadlineSettings> | null): string | undefined {
  const { tipoPA, dataInicioPrazo, dataAssinatura, prorrogacoes } = params;
  const dataBase =
    normalizarDataPrazoPA(dataInicioPrazo)
    || (ehConselhoPA(tipoPA) ? normalizarDataPrazoPA(dataAssinatura) : undefined);

  if (!dataBase) return undefined;

  const { diasIniciais } = obterRegraPrazoPA(tipoPA, configuracao);
  const faixasProrrogacao = calcularFaixasProrrogacaoPA({
    tipoPA,
    dataInicioPrazo,
    dataAssinatura,
    prorrogacoes,
  }, configuracao);

  if (faixasProrrogacao.length > 0) {
    return faixasProrrogacao[faixasProrrogacao.length - 1].fim;
  }

  try {
    const dataFinal = parseISO(`${dataBase}T00:00:00`);
    if (Number.isNaN(dataFinal.getTime())) return undefined;

    dataFinal.setDate(dataFinal.getDate() + diasIniciais - 1);
    return format(dataFinal, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

export function normalizarTextoHistoricoPrazoPA(
  texto: string | undefined | null,
  dataInicioPrazo: string | undefined | null,
): string {
  if (!texto) return "";
  if (!dataInicioPrazo || !PADRAO_HISTORICO_INICIO_PRAZO_PA.test(texto)) return texto;

  const dataFormatada = formatarData(dataInicioPrazo);
  return dataFormatada === "—" ? texto : `Prazo do PA iniciado em ${dataFormatada}.`;
}

export function diasRestantes(prazo: unknown): number {
  if (!prazo) return 999; // Sem prazo = prazo distante
  const d = toDateLocal(prazo);
  if (!d) return 999;
  // differenceInCalendarDays usa fuso LOCAL (correto para Manaus/Brasil).
  return differenceInCalendarDays(d, new Date());
}

export function statusPrazo(prazo: unknown): StatusPrazo {
  if (!prazo) return "safe"; // Sem prazo = não tem urgência
  const d = diasRestantes(prazo);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 5) return "soon";
  return "safe";
}

export function rotuloPrazo(prazo: unknown): string {
  if (!prazo) return "—";
  const d = diasRestantes(prazo);
  if (d < 0) return `−${Math.abs(d)}d`;
  if (d === 0) return "Hoje";
  if (d === 1) return "+1d";
  return `+${d}d`;
}

export function rotuloPrazoLongo(prazo: unknown): string {
  if (!prazo) return "Sem prazo definido";
  const d = diasRestantes(prazo);
  if (d < 0) return `Vencido há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`;
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  return `Faltam ${d} dias`;
}

export function formatarData(prazo: unknown): string {
  if (!prazo) return "—";

  // String simples "YYYY-MM-DD" → caminho legado preservado.
  if (typeof prazo === "string") {
    const dataCivil = normalizarDataPrazoPA(prazo);
    if (dataCivil) {
      try {
        return format(parseISO(`${dataCivil}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
      } catch {
        /* cai no fallback robusto abaixo */
      }
    }
  }

  const d = toDateLocal(prazo);
  if (!d) return "—";
  try {
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function formatarDataCurta(prazo: unknown): string {
  if (!prazo) return "—";
  const d = toDateLocal(prazo);
  if (!d) return "—";
  try {
    return format(d, "dd MMM", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function classesPrazo(status: StatusPrazo): {
  badge: string;
  border: string;
  dot: string;
  text: string;
} {
  switch (status) {
    case "overdue":
      return {
        badge: "bg-[var(--deadline-overdue-bg)] text-[var(--deadline-overdue)] border-[var(--deadline-overdue)]/40",
        border: "border-l-[var(--deadline-overdue)]",
        dot: "bg-[var(--deadline-overdue)] shadow-[0_0_8px_var(--deadline-overdue)]",
        text: "text-[var(--deadline-overdue)]",
      };
    case "today":
      return {
        badge: "bg-[var(--deadline-today-bg)] text-[var(--deadline-today)] border-[var(--deadline-today)]/40",
        border: "border-l-[var(--deadline-today)]",
        dot: "bg-[var(--deadline-today)] shadow-[0_0_8px_var(--deadline-today)]",
        text: "text-[var(--deadline-today)]",
      };
    case "soon":
      return {
        badge: "bg-[var(--deadline-soon-bg)] text-[var(--deadline-soon)] border-[var(--deadline-soon)]/40",
        border: "border-l-[var(--deadline-soon)]",
        dot: "bg-[var(--deadline-soon)] shadow-[0_0_8px_var(--deadline-soon)]",
        text: "text-[var(--deadline-soon)]",
      };
    case "safe":
      return {
        badge: "bg-[var(--deadline-safe-bg)] text-[var(--deadline-safe)] border-[var(--deadline-safe)]/40",
        border: "border-l-[var(--deadline-safe)]",
        dot: "bg-[var(--deadline-safe)] shadow-[0_0_8px_var(--deadline-safe)]",
        text: "text-[var(--deadline-safe)]",
      };
  }
}

/**
 * Mês/ano de referência para o mês corrente, na data local do sistema.
 * Isolada como função nomeada (em vez de `new Date()` inline) para poder
 * ser usada como inicializador "lazy" do useState (`useState(mesAtualLocal)`)
 * e para ser testável isoladamente — ver src/lib/prazo.test.mjs.
 */
export function mesAtualLocal(): Date {
  return new Date();
}
