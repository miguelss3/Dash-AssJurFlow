// ---------------------------------------------------------------------------
// Tipos, constantes e utilitários compartilhados pelos sub-componentes do
// fluxo DU (V2.1). Mantém o arquivo principal magro e consistente.
// ---------------------------------------------------------------------------

export type SituacaoFluxoDU =
  | "MESA_ASSESSOR"
  | "CHEFIA_DILIGENCIA"
  | "AGUARDANDO_ASSINATURA"
  | "AGUARDANDO_RESPOSTA"
  | "FINALIZADO";

export type AcaoPrincipal = "DILIGENCIA" | "DEFESA";

// chefe = Chefe da AssJur assina diretamente (DIEx Simplificado).
// chem  = CHEM aprova via SPED.
// cmt   = Comandante aprova via SPED.
export type AssinaturaDestino = "chefe" | "chem" | "cmt";

export const LABEL_ASSINATURA_DESTINO: Record<AssinaturaDestino, string> = {
  chefe: "Chefe da AssJur",
  chem: "CHEM",
  cmt: "Comandante",
};

export const LABEL_ACAO: Record<AcaoPrincipal, string> = {
  DILIGENCIA: "Pedido de Subsídios",
  DEFESA: "Resposta Definitiva",
};

export const LABEL_SITUACAO: Record<SituacaoFluxoDU, string> = {
  MESA_ASSESSOR: "Mesa do Assessor",
  CHEFIA_DILIGENCIA: "Na Chefia",
  AGUARDANDO_ASSINATURA: "Aguardando Assinatura no SPED",
  AGUARDANDO_RESPOSTA: "Aguardando Resposta",
  FINALIZADO: "Finalizado",
};

// Identidade visual unificada — "Despacho de Documento".
export const DOC_LABEL_CLASS =
  "block text-[11px] font-bold text-slate-900 uppercase tracking-wide mb-2";

export const DOC_INPUT_CLASS =
  "w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm bg-white focus:border-[#0F172A]";

export const DOC_PRIMARY_BTN_CLASS =
  "w-full bg-[#0F172A] hover:bg-slate-800 text-white font-bold py-3 rounded-md flex items-center justify-center gap-2 disabled:opacity-50";

export const DOC_SECONDARY_BTN_CLASS =
  "w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100";

export const DOC_DANGER_BTN_CLASS =
  "w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-md transition-colors";

// V2.4 — Wrapper colorido do "Bloco de Documento" segundo o signatário.
// Azul claro = interno (Chefe / DIEx Simplificado). Verde = externo (CHEM/Cmt).
export const docContainerClass = (destino: AssinaturaDestino) =>
  destino === "chefe"
    ? "bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-5 shadow-sm"
    : "bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-5 shadow-sm";

// V2.4 — Estilo do checkbox "pill" para tipos de documento externo (DIEx / Ofício).
export const docCheckboxPillClass = (selected: boolean) =>
  `flex items-center justify-center gap-2 p-2.5 border rounded-md text-xs font-bold cursor-pointer transition-colors ${
    selected
      ? "bg-emerald-700 text-white border-emerald-700"
      : "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100"
  }`;

// Estilo dos radios em formato "pill de documento".
export const docRadioClass = (selected: boolean) =>
  `flex items-center justify-center gap-2 p-2.5 border rounded-md text-xs font-bold cursor-pointer transition-colors ${
    selected
      ? "bg-[#0F172A] text-white border-[#0F172A]"
      : "bg-white text-[#0F172A] border-slate-300 hover:bg-slate-50"
  }`;

// Mapeia QUALQUER estado legado para um dos 4 estados ativos do V2.1.
export const normalizeSituacao = (situacao?: string): SituacaoFluxoDU => {
  switch (situacao) {
    case "MESA_ASSESSOR":
    case "CHEFIA_DILIGENCIA":
    case "AGUARDANDO_ASSINATURA":
    case "AGUARDANDO_RESPOSTA":
      return situacao;
    case "CHEFIA_DEFESA":
    case "aguardando_assinatura_secao":
    case "aguardando_aprovacao_externa":
    case "enviado_admin":
      return "CHEFIA_DILIGENCIA";
    case "AGUARDANDO_CHEM_DILIGENCIA":
    case "AGUARDANDO_CHEM_DEFESA":
    case "aprovado_externo_enviado_chem":
    case "aprovado_externo_aguardando_chem":
      return "AGUARDANDO_ASSINATURA";
    default:
      return "MESA_ASSESSOR";
  }
};
