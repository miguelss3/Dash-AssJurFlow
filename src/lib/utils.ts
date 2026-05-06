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

const BADGE_SITUACAO_PA: Record<string, string> = {
  FAZENDO_PORTARIA: "Fazendo Portaria",
  ASSINANDO_PORTARIA: "Aguardando Assinatura da Portaria",
  AGUARDANDO_ENTREGA: "Aguardando Entrega ao Encarregado",
  AGUARDANDO_PRAZO: "Aguardando Entrega ao Encarregado",
  COM_ENCARREGADO: "Com o Encarregado",
  FAZENDO_SOLUCAO: "Fazendo Solucao/Parecer",
  ASSINANDO_SOLUCAO: "Aguardando Assinatura da Solucao",
  COM_CONSELHO: "Com o Conselho",
  NA_CHEFIA: "Na Chefia",
  MESA_ASSESSOR: "Mesa do Assessor",
  FINALIZADO: "Finalizado",
};

const normalizarSituacao = (valor?: string | null): string => {
  return String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export function getBadgeSituacaoPA(params: {
  situacaoFluxoPA?: string | null;
  situacaoFluxoConselho?: string | null;
  situacaoFluxoIP?: string | null;
  situacaoFluxoLegado?: string | null;
  status?: string | null;
}): string {
  const sitPA = normalizarSituacao(params.situacaoFluxoPA);
  const sitConselho = normalizarSituacao(params.situacaoFluxoConselho);
  const sitIP = normalizarSituacao(params.situacaoFluxoIP);
  const sitLegado = normalizarSituacao(params.situacaoFluxoLegado);
  const st = String(params.status || "").trim();

  const efetiva = sitPA || sitConselho || sitIP || sitLegado;
  if (efetiva && BADGE_SITUACAO_PA[efetiva]) return BADGE_SITUACAO_PA[efetiva];
  if (efetiva) {
    const limpo = efetiva.replace(/_/g, " ").toLowerCase();
    return limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }
  return st || "Sem situacao";
}
