export type StatusProcesso =
  | "novo"
  | "andamento"
  | "audiencia"
  | "recurso"
  | "concluido";

export type TipoProcesso = "DU" | "PA" | "OUTRO";
export type Prioridade = "liminar" | "urgente" | "normal";

// V4.0 — Máquina de estados dos Processos Administrativos.
// V5.3: o modal legado `AcoesPAModalNovo.tsx` foi removido; o motor é
// orquestrado por `AcoesPAModalV4`, `AcoesConselhoModalV4` e `AcoesIPModalV4`.
export type SituacaoFluxoPA =
  | "FAZENDO_PORTARIA"
  | "ASSINANDO_PORTARIA"
  | "AGUARDANDO_ENTREGA"
  | "COM_ENCARREGADO"
  | "FAZENDO_SOLUCAO"
  | "ASSINANDO_SOLUCAO"
  | "FINALIZADO";

export const LABEL_SITUACAO_PA: Record<SituacaoFluxoPA, string> = {
  FAZENDO_PORTARIA: "Portaria Confeccionada",
  ASSINANDO_PORTARIA: "Aguardando Assinatura da Portaria",
  AGUARDANDO_ENTREGA: "Aguardando Entrega ao Encarregado",
  COM_ENCARREGADO: "Com o Encarregado",
  FAZENDO_SOLUCAO: "Fazendo Solução/Parecer",
  ASSINANDO_SOLUCAO: "Aguardando Assinatura da Solução",
  FINALIZADO: "Finalizado",
};

// V5.0 — Máquina de estados exclusiva dos Conselhos (Disciplina/Justificação).
// O rito é diferente do PA comum: prazo de 30 dias corridos a partir de
// (assinatura + 1 dia), prorrogações de 20 dias, triagem de recurso e
// envio final à ATH. Convive com `SituacaoFluxoPA` sem cruzamento.
export type SituacaoFluxoConselho =
  | "FAZENDO_PORTARIA"
  | "ASSINANDO_PORTARIA"
  | "COM_CONSELHO"
  | "AGUARDANDO_DESPACHO_PRORROGACAO"
  | "TRIAGEM_AUTOS"
  | "FAZENDO_RESPOSTA_RECURSO"
  | "DECISAO_AUTORIDADE"
  | "ENVIO_ATH"
  | "FINALIZADO";

export const LABEL_SITUACAO_CONSELHO: Record<SituacaoFluxoConselho, string> = {
  FAZENDO_PORTARIA: "Portaria Confeccionada",
  ASSINANDO_PORTARIA: "Aguardando Assinatura da Portaria",
  COM_CONSELHO: "Em Andamento (Com o Conselho)",
  AGUARDANDO_DESPACHO_PRORROGACAO: "Aguardando Despacho (Prorrogação)",
  TRIAGEM_AUTOS: "Triagem dos Autos Concluídos",
  FAZENDO_RESPOSTA_RECURSO: "Elaborando Resposta a Recurso",
  DECISAO_AUTORIDADE: "Aguardando Decisão da Autoridade",
  ENVIO_ATH: "Aguardando Envio à ATH",
  FINALIZADO: "Finalizado",
};

// V5.1 — Motor "Ping-Pong" de Investigação Preliminar (IP).
// Fluxo deliberadamente livre: o status só registra de quem é a "bola"
// (Assessor x Chefia) ou se foi finalizado. Toda a riqueza fica em
// `documentosIP` e na subcoleção /historico (notas livres).
export type SituacaoFluxoIP = "MESA_ASSESSOR" | "NA_CHEFIA" | "FINALIZADO";

export const LABEL_SITUACAO_IP: Record<SituacaoFluxoIP, string> = {
  MESA_ASSESSOR: "Na Mesa do Assessor",
  NA_CHEFIA: "Com a Chefia",
  FINALIZADO: "Finalizado",
};

export interface DocumentoIP {
  tipo: "Expedido" | "Recebido";
  descricao: string;
  data: string;
  registradoPor: string;
  registradoEm?: string;
}

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
  // V2.5 — Histórico de documentos enviados.
  // Aceita strings (formato legado) e objetos estruturados (novos envios).
  numeroDiexHistorico?: Array<
    | string
    | { numero: string; dataEnvio: string; prazo?: string; nomeDocumento?: string }
  >;
  prazoResposta?: string;
  observacoes?: string;
  // V2.4 — Composição de documentos externos (CHEM/Cmt).
  incluiDiexExterno?: boolean;
  incluiOficioExterno?: boolean;
  numeroDiexExterno?: string;
  numeroOficioExterno?: string;
  situacaoFluxo?: string;
  solicitadoEm?: string;
  solicitadoPorNome?: string;
  assinaturaChefiaEm?: string;
  assinaturaChemEm?: string;
  reiteracoes?: number;
}

export interface RespostaDU {
  numeroOficio?: string;
  numeroOficioExterno?: string;
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
  // V4.0 — Nova máquina de estados (paralela ao `situacaoFluxo` legado).
  situacaoFluxoPA?: SituacaoFluxoPA;
  // V5.0 — Máquina de estados exclusiva dos Conselhos.
  situacaoFluxoConselho?: SituacaoFluxoConselho;
  numeroMemoriaAth?: string;
  pendenciaProrrogacao?: string;
  prazoRespostaRecurso?: string;
  docEnvioAth?: string;
  // V5.1 — Motor Ping-Pong de Investigação Preliminar.
  situacaoFluxoIP?: SituacaoFluxoIP;
  documentosIP?: DocumentoIP[];
  finalizado?: boolean;
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
  // V2.4 — Composição de documentos externos espelhada na raiz.
  incluiDiexExterno?: boolean;
  incluiOficioExterno?: boolean;
  numeroDiexExterno?: string;
  numeroOficioExterno?: string;
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
