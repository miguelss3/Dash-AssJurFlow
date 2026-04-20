import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type StatusPrazo = "overdue" | "today" | "soon" | "safe";

export function diasRestantes(prazoISO: string): number {
  return differenceInCalendarDays(parseISO(prazoISO), new Date());
}

export function statusPrazo(prazoISO: string): StatusPrazo {
  const d = diasRestantes(prazoISO);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 5) return "soon";
  return "safe";
}

export function rotuloPrazo(prazoISO: string): string {
  const d = diasRestantes(prazoISO);
  if (d < 0) return `−${Math.abs(d)}d`;
  if (d === 0) return "Hoje";
  if (d === 1) return "+1d";
  return `+${d}d`;
}

export function rotuloPrazoLongo(prazoISO: string): string {
  const d = diasRestantes(prazoISO);
  if (d < 0) return `Vencido há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`;
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  return `Faltam ${d} dias`;
}

export function formatarData(prazoISO: string): string {
  return format(parseISO(prazoISO), "dd/MM/yyyy", { locale: ptBR });
}

export function formatarDataCurta(prazoISO: string): string {
  return format(parseISO(prazoISO), "dd MMM", { locale: ptBR });
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
