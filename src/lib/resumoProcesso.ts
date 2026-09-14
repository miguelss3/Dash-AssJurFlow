import type { Processo } from "@/types/processo";
import { formatarData, diasRestantes } from "@/lib/prazo";

// Mini-resumo gerado por template (sem IA) — monta uma frase curta só com o
// que já está cadastrado no card. Não lê "Observações"/"Descrição" livres,
// apenas campos estruturados (data de entrada, prazo, status, responsável).

function situacaoTexto(p: Processo): string {
  if (p.status === "concluido") return "concluído";
  if (p.processoReaberto) return "reaberto e em andamento";
  return "em andamento";
}

function prazoTexto(p: Processo): string {
  if (p.status === "concluido" || !p.prazoFatal) return "";
  const dias = diasRestantes(p.prazoFatal);
  const dataFmt = formatarData(p.prazoFatal);
  if (dias < 0) return `, com prazo fatal vencido em ${dataFmt}`;
  if (dias <= 5) return `, com prazo fatal próximo (${dataFmt})`;
  return `, com prazo fatal em ${dataFmt}`;
}

export function gerarResumoDU(p: Processo): string {
  const abertura: string[] = [`DU nº ${p.numero}`];
  if (p.tipoAcao) abertura.push(`referente a ${p.tipoAcao}`);
  if (p.cliente) abertura.push(`de ${p.cliente}`);

  const detalhes: string[] = [];
  if (p.dataEntrada) detalhes.push(`protocolado em ${formatarData(p.dataEntrada)}`);
  detalhes.push(situacaoTexto(p));
  if (p.responsavel) detalhes.push(`sob responsabilidade de ${p.responsavel}`);

  let frase = `${abertura.join(", ")}. Processo ${detalhes.join(", ")}${prazoTexto(p)}.`;
  if (p.isMS) frase += " Trata-se de Mandado de Segurança (urgente).";
  return frase;
}

export function gerarResumoPA(p: Processo): string {
  const abertura: string[] = [`${p.tipoPA || "PA"} nº ${p.numero}`];
  if (p.tipoAcao) abertura.push(`referente a ${p.tipoAcao}`);
  if (p.cliente) abertura.push(`envolvendo ${p.cliente}`);

  const detalhes: string[] = [];
  if (p.dataEntrada) detalhes.push(`protocolado em ${formatarData(p.dataEntrada)}`);
  detalhes.push(situacaoTexto(p));
  if (p.encarregado) detalhes.push(`com ${p.encarregado} como encarregado`);
  if (p.responsavel) detalhes.push(`assessoria de ${p.responsavel}`);

  return `${abertura.join(", ")}. Processo ${detalhes.join(", ")}${prazoTexto(p)}.`;
}
