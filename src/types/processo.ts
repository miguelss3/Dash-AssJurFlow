export type StatusProcesso =
  | "novo"
  | "andamento"
  | "audiencia"
  | "recurso"
  | "concluido";

export type TipoProcesso = "DU" | "PA" | "OUTRO";
export type Prioridade = "liminar" | "urgente" | "normal";

export interface PedidoSubsidios {
  tipoSolicitacao?: "primeira_vez" | "reiteracao";
  tipoDestino?: "interno" | "externo";
  tipoDiligencia?: "INTERNO" | "EXTERNO";
  acaoPrincipal?: "DILIGENCIA" | "DEFESA";
  // Novo fluxo "Tramitação Livre Vigiada" (DU)
  assinaturaDestino?: "chefe" | "chem" | "cmt";
  numeroDocumentoDU?: string;
  possuiPrazoDU?: boolean;
  secaoInterna?: string;
  omExterna?: string;
  numeroDiex?: string;
  numeroSaida?: string;
  numeroRecebido?: string;
  numeroDocFinal?: string;
  dataPrazo?: string;
  numeroDiexHistorico?: string[];
  prazoResposta?: string;
  observacoes?: string;
  situacaoFluxo?: string;
  solicitadoEm?: string;
  solicitadoPorNome?: string;
  assinaturaChefiaEm?: string;
  assinaturaChemEm?: string;
  reiteracoes?: number;
}

export interface RespostaDU {
  numeroOficio?: string;
  numeroDiex?: string;
  numeroRecebido?: string;
  destinoDocumento?: string;
  dataEnvio?: string;
  observacoes?: string;
  situacao?: string;
  registradoEm?: string;
  registradoPorNome?: string;
}

export interface UltimaAcaoFluxo {
  tipo?: "DU" | "PA";
  criadoEm?: string;
  criadoPorNome?: string;
  previousDoc?: Record<string, unknown>;
}

export interface Processo {
  id: string;
  numero: string;          // Nº processo OU Portaria Nr
  cliente: string;         // Parte / interessado
  vara: string;
  parteContraria: string;
  tipoAcao: string;        // Assunto / objeto
  responsavel: string;     // Assessor (Ten/Cap/Maj/TC...)
  prazo?: string;          // ISO — prazo INTERNO (opcional)
  prazoFatal?: string;     // ISO — prazo FATAL (limite final)
  descricao: string;       // Último movimento
  status: StatusProcesso;
  criadoEm: string;
  atualizadoEm?: string;
  // Campos AssJur Flow
  tipo: TipoProcesso;
  setor?: string;          // DU ou PA (vem do Firebase - sistema antigo)
  prioridade: Prioridade;
  secao: string;           // Ex: SFPC, SVP, DiEx, ICFEX
  origem: string;          // Ex: E-mail, Ofício, DiEx, SAPIENS
  // Campos DU específicos
  origemDU?: string;       // SAPIENS, Ofício, E-mail, Whatsapp, Presencial
  secaoDU?: string;        // SVP, SJUR, SAJ
  isMS?: boolean;          // É Mandado de Segurança / Urgente
  dataEntrada?: string;    // ISO data de entrada
  observacoes?: string;    // Observações adicionais
  // Específicos PA (Procedimento Apuratório)
  tipoPA?: string;         // IPM, Sindicância, Conselho de Disciplina
  encarregado?: string;    // Encarregado do PA
  presidenteConselhoPosto?: string;
  presidenteConselhoNome?: string;
  omPresidenteConselho?: string;
  situacaoFluxo?: string;
  primeiraPortaria?: string;
  interessado?: string;
  dataAssinatura?: string;
  dataInicioPrazo?: string;
  despachoFinal?: string;
  prorrogacoes?: Array<{
    dias: number;
    doc: string;
    inicio?: string;
    fim?: string;
    em?: string;
    por?: string;
  }>;
  decisaoAutNomeante?: string;
  numeroDIExRemessa?: string;
  resultadoFinalConselho?: string;
  teveRecurso?: boolean;
  membrosConselho?: string;
  subtipo?: string;        // IPM, Sindicância, Diligência
  faseAtual?: string;      // Em diligência, Portaria assinada, Para assinatura, Atrasado, Prazo não iniciado
  inicioPrazo?: string;    // ISO
  finalPrazo?: string;     // ISO
  entrada?: string;        // ISO data de entrada
  // Vínculo com usuário (Firebase Authentication)
  userId?: string;         // UID do Firebase do dono do processo
  userEmail?: string;      // Email do usuário para referência
  criadoPorNome?: string;  // Nome/email de quem cadastrou
  atualizadoPorNome?: string; // Nome/email de quem atualizou por último
  processoReaberto?: boolean;
  motivoReabertura?: string;
  reabertoEm?: string;
  reabertoPorNome?: string;
  pedidoSubsidios?: PedidoSubsidios;
  respostaDU?: RespostaDU;
  ultimaAcaoFluxo?: UltimaAcaoFluxo;
  // Campos top-level do novo fluxo DU "Tramitação Livre Vigiada"
  assinaturaDestino?: "chefe" | "chem" | "cmt";
  numeroDocumentoDU?: string;
  possuiPrazoDU?: boolean;
}

export interface Coluna {
  id: StatusProcesso;
  titulo: string;
  descricao: string;
}

export const COLUNAS: Coluna[] = [
  { id: "novo", titulo: "Triagem", descricao: "Aguardando análise inicial" },
  { id: "andamento", titulo: "Em Andamento", descricao: "Processo ativo" },
  { id: "audiencia", titulo: "Audiência", descricao: "Designada / em curso" },
  { id: "recurso", titulo: "Recurso", descricao: "Em fase recursal" },
  { id: "concluido", titulo: "Concluído", descricao: "Arquivado / finalizado" },
];

export const TIPOS: { id: TipoProcesso; label: string; color: string }[] = [
  { id: "DU", label: "DU", color: "oklch(0.78 0.16 220)" },
  { id: "PA", label: "PA", color: "oklch(0.7 0.22 305)" },
  { id: "OUTRO", label: "Outro", color: "oklch(0.7 0.03 245)" },
];

export const PRIORIDADES: { id: Prioridade; label: string }[] = [
  { id: "liminar", label: "Liminar" },
  { id: "urgente", label: "Urgente" },
  { id: "normal", label: "Normal" },
];

export type FiltroPrazo = "todos" | "vencidos" | "hoje" | "semana";
