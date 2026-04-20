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
  if (d < 0) return `Vencido há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`;
  if (d === 0) return "Vence hoje";
  if (d === 1) return "Vence amanhã";
  return `Faltam ${d} dias`;
}

export function formatarData(prazoISO: string): string {
  return format(parseISO(prazoISO), "dd 'de' MMM 'de' yyyy", { locale: ptBR });
}

export function classesPrazo(status: StatusPrazo): {
  badge: string;
  border: string;
  dot: string;
} {
  switch (status) {
    case "overdue":
      return {
        badge: "bg-[var(--deadline-overdue-bg)] text-[var(--deadline-overdue)] border-[var(--deadline-overdue)]/30",
        border: "border-l-[var(--deadline-overdue)]",
        dot: "bg-[var(--deadline-overdue)]",
      };
    case "today":
      return {
        badge: "bg-[var(--deadline-today-bg)] text-[var(--deadline-today)] border-[var(--deadline-today)]/30",
        border: "border-l-[var(--deadline-today)]",
        dot: "bg-[var(--deadline-today)]",
      };
    case "soon":
      return {
        badge: "bg-[var(--deadline-soon-bg)] text-[var(--deadline-soon)] border-[var(--deadline-soon)]/30",
        border: "border-l-[var(--deadline-soon)]",
        dot: "bg-[var(--deadline-soon)]",
      };
    case "safe":
      return {
        badge: "bg-[var(--deadline-safe-bg)] text-[var(--deadline-safe)] border-[var(--deadline-safe)]/30",
        border: "border-l-[var(--deadline-safe)]",
        dot: "bg-[var(--deadline-safe)]",
      };
  }
}
