import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DEFAULT_PROCESSUAL_DEADLINES,
  type ProcessualDeadlineSettings,
} from "@/types/siteSettings";

export type StatusPrazo = "overdue" | "today" | "soon" | "safe";

type ProrrogacaoPA = {
  dias?: number | null;
  inicio?: string | null;
  fim?: string | null;
} | null | undefined;

const PADRAO_HISTORICO_INICIO_PRAZO_PA = /^Prazo do PA iniciado em .*\.$/i;

export function ehConselhoPA(tipoPA: string | undefined | null): boolean {
  return tipoPA === "Conselho de Disciplina" || tipoPA === "Conselho de Justificação";
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

    let inicio = inicioInformado || fimAnterior;
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

export function diasRestantes(prazoISO: string | undefined | null): number {
  if (!prazoISO) return 999; // Sem prazo = prazo distante
  try {
    return differenceInCalendarDays(parseISO(prazoISO), new Date());
  } catch {
    return 999; // Erro ao parsear = prazo distante
  }
}

export function statusPrazo(prazoISO: string | undefined | null): StatusPrazo {
  if (!prazoISO) return "safe"; // Sem prazo = não tem urgência
  const d = diasRestantes(prazoISO);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 5) return "soon";
  return "safe";
}

export function rotuloPrazo(prazoISO: string | undefined | null): string {
  if (!prazoISO) return "—";
  const d = diasRestantes(prazoISO);
  if (d < 0) return `−${Math.abs(d)}d`;
  if (d === 0) return "Hoje";
  if (d === 1) return "+1d";
  return `+${d}d`;
}

export function rotuloPrazoLongo(prazoISO: string | undefined | null): string {
  if (!prazoISO) return "Sem prazo definido";
  const d = diasRestantes(prazoISO);
  if (d < 0) return `Vencido há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`;
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  return `Faltam ${d} dias`;
}

export function formatarData(prazoISO: string | undefined | null): string {
  if (!prazoISO) return "—";

  const dataCivil = normalizarDataPrazoPA(prazoISO);
  if (dataCivil) {
    try {
      return format(parseISO(`${dataCivil}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  }

  try {
    return format(parseISO(prazoISO), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function formatarDataCurta(prazoISO: string | undefined | null): string {
  if (!prazoISO) return "—";
  try {
    return format(parseISO(prazoISO), "dd MMM", { locale: ptBR });
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
