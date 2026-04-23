import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type StatusPrazo = "overdue" | "today" | "soon" | "safe";

type ProrrogacaoPA = {
  dias?: number | null;
} | null | undefined;

export function ehConselhoPA(tipoPA: string | undefined | null): boolean {
  return tipoPA === "Conselho de Disciplina" || tipoPA === "Conselho de Justificação";
}

export function obterRegraPrazoPA(tipoPA: string | undefined | null): {
  diasIniciais: number;
  diasProrrogacao: number;
} {
  if (tipoPA === "IPM") {
    return { diasIniciais: 40, diasProrrogacao: 20 };
  }

  if (tipoPA === "Sindicância" || tipoPA === "Sindicancia") {
    return { diasIniciais: 30, diasProrrogacao: 20 };
  }

  return { diasIniciais: 30, diasProrrogacao: 20 };
}

function normalizarDataPrazoPA(valor: string | undefined | null): string | undefined {
  if (!valor) return undefined;

  const texto = String(valor).trim();
  if (!texto) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  try {
    const data = parseISO(texto);
    if (Number.isNaN(data.getTime())) return undefined;
    return format(data, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

export function calcularPrazoFinalPA(params: {
  tipoPA?: string | null;
  dataInicioPrazo?: string | null;
  dataAssinatura?: string | null;
  prorrogacoes?: ProrrogacaoPA[] | null;
}): string | undefined {
  const { tipoPA, dataInicioPrazo, dataAssinatura, prorrogacoes } = params;
  const dataBase =
    normalizarDataPrazoPA(dataInicioPrazo)
    || (ehConselhoPA(tipoPA) ? normalizarDataPrazoPA(dataAssinatura) : undefined);

  if (!dataBase) return undefined;

  const { diasIniciais, diasProrrogacao } = obterRegraPrazoPA(tipoPA);
  const diasExtras = (prorrogacoes || []).reduce((total, item) => {
    const dias = item?.dias;
    return total + (typeof dias === "number" && Number.isFinite(dias) ? dias : diasProrrogacao);
  }, 0);

  try {
    const dataFinal = parseISO(`${dataBase}T00:00:00`);
    if (Number.isNaN(dataFinal.getTime())) return undefined;

    dataFinal.setDate(dataFinal.getDate() + diasIniciais + diasExtras);
    return format(dataFinal, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
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
