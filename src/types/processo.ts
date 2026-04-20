export type StatusProcesso =
  | "novo"
  | "andamento"
  | "audiencia"
  | "recurso"
  | "concluido";

export type TipoProcesso = "DU" | "PA" | "OUTRO";
export type Prioridade = "liminar" | "urgente" | "normal";

export interface Processo {
  id: string;
  numero: string;
  cliente: string;        // Parte / cliente
  vara: string;
  parteContraria: string;
  tipoAcao: string;
  responsavel: string;
  prazo: string;          // ISO — prazo INTERNO
  prazoFatal?: string;    // ISO — prazo FATAL (limite final)
  descricao: string;
  status: StatusProcesso;
  criadoEm: string;
  // Novos campos inspirados no AssJur Flow
  tipo: TipoProcesso;
  prioridade: Prioridade;
  secao: string;          // Ex: SFPC, SVP, DiEx
  origem: string;         // Ex: E-mail, Ofício, DiEx
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
