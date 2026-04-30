import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// V2.10 — Tradução do estado do motor de fluxo DU para o rótulo da coluna
// correspondente no Kanban. Usado por badges em cards e modais de detalhes.
const BADGE_SITUACAO_DU: Record<string, string> = {
  MESA_ASSESSOR: "Mesa do Assessor",
  CHEFIA_DILIGENCIA: "Mesa da Chefia",
  AGUARDANDO_ASSINATURA: "SPED",
  AGUARDANDO_RESPOSTA: "Aguardando Resposta",
};

export function getBadgeSituacaoDU(situacaoFluxo?: string | null): string {
  if (!situacaoFluxo) return "Na Chefia";
  const direto = BADGE_SITUACAO_DU[situacaoFluxo];
  if (direto) return direto;
  const limpo = situacaoFluxo.replace(/_/g, " ").toLowerCase().trim();
  if (!limpo) return "Na Chefia";
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}
