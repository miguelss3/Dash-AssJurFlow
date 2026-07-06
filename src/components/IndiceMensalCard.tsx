import { useMemo } from "react";
import { BarChart2, Loader2 } from "lucide-react";
import type { ProcessosStats } from "@/hooks/useProcessosStats";
import { useAcervoProcessual } from "@/hooks/useAcervoProcessual";
import type { Processo } from "@/types/processo";
import { toDateLocal } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  loadingProcessos?: boolean;
  statsServidor: ProcessosStats;
}

/**
 * Verifica se uma data (Timestamp do Firestore OU String ISO) pertence ao mesmo
 * mês/ano de uma data de referência. Usa fuso LOCAL (correto para Manaus/Brasil).
 */
function ehDoMesAtual(value: unknown, ref: Date): boolean {
  const d = toDateLocal(value);
  if (!d) return false;
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/**
 * Card "Índice Mensal" — extraído do Dashboard para viver na sidebar
 * (logo acima do usuário), mantendo o mesmo layout de caixa branca e barra
 * de progressão da Resolutividade do mês.
 */
export function IndiceMensalCard({ processos, loadingProcessos = false, statsServidor }: Props) {
  const mesRef = useMemo(() => new Date(), []);

  const criadosMes = useMemo(
    () =>
      processos.filter((p) => {
        // pode existir tanto `criadoEm` (novo) quanto `dataEntrada` (legado)
        return (
          ehDoMesAtual(p.criadoEm, mesRef) ||
          ehDoMesAtual((p as unknown as { dataEntrada?: unknown }).dataEntrada, mesRef)
        );
      }).length,
    [processos, mesRef],
  );

  const finalizadosMes = useMemo(
    () =>
      processos.reduce((acc, p) => {
        if (p.status !== "concluido") return acc;
        return acc + (ehDoMesAtual(p.atualizadoEm, mesRef) ? 1 : 0);
      }, 0),
    [processos, mesRef],
  );

  const mesNome = useMemo(
    () => mesRef.toLocaleString("pt-BR", { month: "long", year: "numeric" }),
    [mesRef],
  );

  const resolutividadeMes = criadosMes > 0 ? Math.round((finalizadosMes / criadosMes) * 100) : 0;

  const acervo = useAcervoProcessual(processos, loadingProcessos, statsServidor);
  const mostrarPlaceholderAtivos = !acervo.ativosProntos;
  const mostrarPlaceholderHistorico = !acervo.historicoProntos;
  const mostrarPlaceholderCombinado = !acervo.prontos;

  const placeholder = (
    <Loader2 className="inline-block h-[0.7em] w-[0.7em] animate-spin opacity-60 align-middle" />
  );

  return (
    <div className="rounded-2xl bg-card border border-border p-3 shadow-card flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 rounded-md bg-[oklch(0.6_0.16_230_/_0.12)] items-center justify-center shrink-0">
          <BarChart2 className="h-3 w-3 text-[oklch(0.55_0.17_230)]" />
        </span>
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-wider font-bold text-foreground leading-tight">
            Índice Mensal
          </p>
          <p className="text-[9px] text-muted-foreground capitalize leading-tight">
            {mesNome}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Cadastrados</span>
          <span className="text-xs font-bold tabular-nums text-foreground">
            {mostrarPlaceholderAtivos ? placeholder : criadosMes}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Finalizados</span>
          <span className="text-xs font-bold tabular-nums text-[var(--deadline-safe)]">
            {mostrarPlaceholderHistorico ? placeholder : finalizadosMes}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-muted-foreground font-medium">Resolutividade</span>
          <span className="text-[11px] font-bold tabular-nums text-foreground">
            {mostrarPlaceholderCombinado ? placeholder : `${resolutividadeMes}%`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[oklch(0.6_0.16_230)] to-[oklch(0.78_0.18_145)] transition-all"
            style={{ width: `${resolutividadeMes}%` }}
          />
        </div>
      </div>
    </div>
  );
}
