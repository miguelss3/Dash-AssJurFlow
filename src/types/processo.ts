export type StatusProcesso =
  | "novo"
  | "andamento"
  | "audiencia"
  | "recurso"
  | "concluido";

export interface Processo {
  id: string;
  numero: string;
  cliente: string;
  vara: string;
  parteContraria: string;
  tipoAcao: string;
  responsavel: string;
  prazo: string; // ISO date
  descricao: string;
  status: StatusProcesso;
  criadoEm: string;
}

export interface Coluna {
  id: StatusProcesso;
  titulo: string;
}

export const COLUNAS: Coluna[] = [
  { id: "novo", titulo: "Novo" },
  { id: "andamento", titulo: "Em Andamento" },
  { id: "audiencia", titulo: "Audiência" },
  { id: "recurso", titulo: "Recurso" },
  { id: "concluido", titulo: "Concluído" },
];

export type FiltroPrazo = "todos" | "vencidos" | "hoje" | "semana";
