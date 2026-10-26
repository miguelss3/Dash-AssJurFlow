import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Processo } from "@/types/processo";
import { statusPrazo, diasRestantes } from "@/lib/prazo";
import { gerarResumoDU, gerarResumoPA } from "@/lib/resumoProcesso";

function formatDate(dateStr?: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function normalizeText(value?: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isSindicancia(p: Processo) {
  const text = normalizeText([p.tipoPA, p.subtipo, p.tipoAcao, p.descricao].join(" "));
  return text.includes("sindic");
}

function isIPM(p: Processo) {
  const text = normalizeText([p.tipoPA, p.subtipo, p.tipoAcao, p.descricao].join(" "));
  return text.includes("ipm");
}

// Mesma prioridade usada em MesaPA/AssessorGroup para atraso: o prazo FATAL
// é o que conta. `prazo` (interno/opcional) entrava antes aqui e podia
// mascarar o atraso real quando os dois campos estavam preenchidos.
function prazoReferencia(p: Processo) {
  return p.prazoFatal || p.finalPrazo || p.prazo;
}

// Mesmo critério de conclusão usado no restante do app (MesaPA/MesaDU):
// `p.status === "concluido"` sozinho não pega `finalizado === true` com status
// desatualizado, nem a variante acentuada "concluído" — o que fazia um
// processo já finalizado (mas sem o status normalizado) ser contado como
// "em curso" ou até "atrasado" neste relatório.
function ehConcluido(p: Processo) {
  const statusNorm = String(p.status || "").trim().toLowerCase();
  return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
}

function isAtrasado(p: Processo) {
  return !ehConcluido(p) && statusPrazo(prazoReferencia(p)) === "overdue";
}

// Um atraso em PA acontece em uma de duas fases: o Encarregado ainda não
// concluiu a instrução (ou pediu prorrogação), ou o processo já passou para
// o Assessor, que está atrasando a confecção/assinatura da solução.
function motivoAtraso(p: Processo): "Assessor (Solução)" | "Encarregado" {
  const sitPA = String(p.situacaoFluxoPA || "").trim().toUpperCase();
  const emFaseAssessorSolucao = sitPA === "FAZENDO_SOLUCAO" || sitPA === "ASSINANDO_SOLUCAO";
  return emFaseAssessorSolucao ? "Assessor (Solução)" : "Encarregado";
}

function diasParaOrdenacao(p: Processo) {
  const prazo = prazoReferencia(p);
  if (!prazo) return Number.POSITIVE_INFINITY;
  return diasRestantes(prazo);
}

// Evita repetir o cast feio toda vez que uma tabela precisa começar logo
// abaixo da anterior.
function proximoY(doc: jsPDF, fallback: number): number {
  const comAutoTable = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return comAutoTable.lastAutoTable?.finalY ? comAutoTable.lastAutoTable.finalY + 8 : fallback;
}

function buildBasePdf(title: string, subtitle: string, orientation: "p" | "l" = "p") {
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const generatedAt = new Date().toLocaleString("pt-BR");
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(14, 43, 85);
  doc.rect(0, 0, pageWidth, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 14, 20);
  doc.text(`Gerado em: ${generatedAt}`, 14, 25);

  doc.setTextColor(20, 20, 20);
  return doc;
}

// Mesmo agrupamento usado no painel de Estatísticas (ChartCard "Tipos de
// ação mais comuns"): ignora o que vem depois de " - " no assunto e agrupa
// por chave normalizada (sem acento/maiúscula) para não duplicar variações
// de grafia do mesmo assunto. Exceção: quando o prefixo é literalmente
// "Outros" mas existe complemento depois do hífen (ex.: "Outros - Licença
// para tratamento de saúde"), mostra o texto completo em vez de esconder o
// assunto real atrás do rótulo genérico.
function assuntoIndicePrincipal(value?: string): string {
  const texto = String(value || "Outros").trim();
  if (!texto) return "Outros";
  const partes = texto.split(/\s[-–—]\s/);
  const principal = (partes[0] || texto).trim() || "Outros";
  if (normalizeText(principal) === "outros" && partes.length > 1) {
    return texto;
  }
  return principal;
}

function setorDe(p: Processo): string {
  return (p.setor || p.tipo || "").toString().trim().toUpperCase();
}

const LABEL_STATUS: Record<string, string> = {
  novo: "Triagem",
  andamento: "Em Andamento",
  concluido: "Concluído",
};

// Percentuais arredondados para número inteiro, cada um independentemente,
// podem não somar 100% (ex.: 2% + 9% + 90% = 101%). Uma casa decimal reduz
// bastante esse erro de arredondamento — formato pt-BR (vírgula decimal).
function formatarPercentual(parte: number, total: number): string {
  if (total <= 0) return "0,0%";
  return `${((parte / total) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

// Gráfico de barras desenhado direto no PDF (sem depender de captura de
// tela): duas colunas por mês — verde (processos registrados, escala
// própria pelo maior valor do período) e vermelha (taxa de conclusão,
// sempre 0-100%). Como as duas têm unidades diferentes, cada valor fica
// escrito acima da própria barra em vez de usar um eixo numérico comum,
// que seria enganoso.
function desenharGraficoMensal(
  doc: jsPDF,
  dados: Array<{ rotulo: string; cadastrados: number; taxa: number | null }>,
  x: number,
  y: number,
  largura: number,
  altura: number,
) {
  const VERDE: [number, number, number] = [34, 170, 110];
  const VERMELHO: [number, number, number] = [205, 60, 60];
  const maxCadastrados = Math.max(1, ...dados.map((d) => d.cadastrados));
  const baseY = y + altura;
  const larguraSlot = largura / dados.length;
  const larguraBarra = larguraSlot * 0.32;
  const gapBarras = larguraSlot * 0.06;

  // Legenda.
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setFillColor(...VERDE);
  doc.rect(x, y - 6, 3, 3, "F");
  doc.setTextColor(60, 60, 60);
  doc.text("Registrados", x + 5, y - 3.5);
  doc.setFillColor(...VERMELHO);
  doc.rect(x + 32, y - 6, 3, 3, "F");
  doc.text("Taxa de Conclusão (%)", x + 37, y - 3.5);

  // Linha de base.
  doc.setDrawColor(200, 200, 200);
  doc.line(x, baseY, x + largura, baseY);

  dados.forEach((d, i) => {
    const slotX = x + i * larguraSlot + (larguraSlot - 2 * larguraBarra - gapBarras) / 2;

    const alturaVerde = (d.cadastrados / maxCadastrados) * (altura - 10);
    doc.setFillColor(...VERDE);
    doc.rect(slotX, baseY - alturaVerde, larguraBarra, alturaVerde, "F");
    doc.setFontSize(7);
    doc.setTextColor(...VERDE);
    doc.text(String(d.cadastrados), slotX + larguraBarra / 2, baseY - alturaVerde - 1.5, { align: "center" });

    const alturaVermelha = ((d.taxa ?? 0) / 100) * (altura - 10);
    const xVermelha = slotX + larguraBarra + gapBarras;
    doc.setFillColor(...VERMELHO);
    doc.rect(xVermelha, baseY - alturaVermelha, larguraBarra, alturaVermelha, "F");
    doc.setTextColor(...VERMELHO);
    doc.text(
      d.taxa === null ? "-" : `${Math.round(d.taxa)}%`,
      xVermelha + larguraBarra / 2,
      baseY - alturaVermelha - 1.5,
      { align: "center" },
    );

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(d.rotulo, x + i * larguraSlot + larguraSlot / 2, baseY + 5, { align: "center" });
  });

  doc.setTextColor(20, 20, 20);
  doc.setDrawColor(0, 0, 0);
}

// V3 — Relatório pensado para circular fora da equipe (chefia, outras OMs):
// sem prazos/atrasos internos, com os números que dão uma visão geral de
// volume e produtividade (cadastros e conclusão mês a mês, assuntos mais
// recorrentes). Separado por setor — este é o de Defesa da União; o de
// Processos Administrativos (exportIndicadoresPAPdf) é um resumo mais
// enxuto, logo abaixo.
export function exportIndicadoresDUPdf(processosTodos: Processo[]) {
  const processos = processosTodos.filter((p) => setorDe(p) === "DU");
  const total = processos.length;
  const concluidos = processos.filter(ehConcluido).length;
  const ativos = total - concluidos;

  const statusRows = ["novo", "andamento", "concluido"].map((status) => {
    const quantidade = processos.filter((p) => p.status === status).length;
    return [LABEL_STATUS[status], String(quantidade), formatarPercentual(quantidade, total)];
  });

  // Cadastros e conclusão por mês — mesma janela de 6 meses do painel.
  const agora = new Date();
  const meses = Array.from({ length: 6 }).map((_, index) => {
    const ref = new Date(agora.getFullYear(), agora.getMonth() - (5 - index), 1);
    return {
      chave: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
      rotulo: ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      rotuloCurto: ref.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  });
  const porMes = new Map(meses.map((m) => [m.chave, { cadastrados: 0, concluidos: 0 }]));
  processos.forEach((p) => {
    const dataBase = p.criadoEm || p.dataEntrada;
    if (!dataBase) return;
    const d = new Date(dataBase);
    if (Number.isNaN(d.getTime())) return;
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = porMes.get(chave);
    if (!bucket) return;
    bucket.cadastrados += 1;
    if (ehConcluido(p)) bucket.concluidos += 1;
  });
  const dadosGraficoMensal = meses.map((m) => {
    const b = porMes.get(m.chave) as { cadastrados: number; concluidos: number };
    return {
      rotulo: m.rotuloCurto,
      cadastrados: b.cadastrados,
      taxa: b.cadastrados > 0 ? (b.concluidos / b.cadastrados) * 100 : null,
    };
  });
  const mensalRows = meses.map((m) => {
    const b = porMes.get(m.chave) as { cadastrados: number; concluidos: number };
    const taxa = b.cadastrados > 0 ? formatarPercentual(b.concluidos, b.cadastrados) : "-";
    const rotulo = m.rotulo.charAt(0).toUpperCase() + m.rotulo.slice(1);
    return [rotulo, String(b.cadastrados), String(b.concluidos), taxa];
  });

  // Assuntos mais frequentes (Top 5).
  const mapaAssuntos = new Map<string, { nome: string; valor: number }>();
  processos.forEach((p) => {
    const principal = assuntoIndicePrincipal(p.tipoAcao);
    const chave = normalizeText(principal);
    const atual = mapaAssuntos.get(chave);
    if (!atual) {
      mapaAssuntos.set(chave, { nome: principal, valor: 1 });
      return;
    }
    mapaAssuntos.set(chave, { ...atual, valor: atual.valor + 1 });
  });
  const assuntosRows = Array.from(mapaAssuntos.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5)
    .map((item) => [item.nome, String(item.valor), formatarPercentual(item.valor, total)]);

  const doc = buildBasePdf(
    "Indicadores de Gestão - Defesa da União",
    "Resumo consolidado de produtividade e distribuição do acervo de DU",
  );
  const pageHeight = doc.internal.pageSize.getHeight();

  // Evita heading/gráfico cortado na virada de página — se não couber o
  // bloco inteiro antes da margem inferior, pula pra próxima página.
  const garantirEspaco = (yAtual: number, alturaNecessaria: number): number => {
    if (yAtual + alturaNecessaria > pageHeight - 15) {
      doc.addPage();
      return 20;
    }
    return yAtual;
  };

  autoTable(doc, {
    startY: 36,
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de processos cadastrados", String(total)],
      ["Processos finalizados", String(concluidos)],
      ["Processos ativos", String(ativos)],
      ["Taxa de conclusão geral", formatarPercentual(concluidos, total)],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [26, 86, 219] },
  });

  autoTable(doc, {
    startY: proximoY(doc, 92),
    head: [["Status", "Quantidade", "% do total"]],
    body: statusRows,
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  // Heading + gráfico + tabela andam juntos — ~125mm no total.
  const yMensal = garantirEspaco(proximoY(doc, 150), 125);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cadastros e Conclusão por Mês", 14, yMensal);

  const larguraGrafico = doc.internal.pageSize.getWidth() - 28;
  desenharGraficoMensal(doc, dadosGraficoMensal, 14, yMensal + 14, larguraGrafico, 45);

  autoTable(doc, {
    startY: yMensal + 70,
    head: [["Mês", "Registrados", "Concluídos", "Taxa de Conclusão"]],
    body: mensalRows,
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  const yAssuntos = garantirEspaco(proximoY(doc, 220), 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Assuntos Mais Frequentes", 14, yAssuntos);
  autoTable(doc, {
    startY: yAssuntos + 2,
    head: [["Assunto", "Quantidade", "% do total"]],
    body: assuntosRows.length > 0 ? assuntosRows : [["-", "-", "-"]],
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  doc.save("indicadores-du.pdf");
}

// V1 — Resumo enxuto de PA: volume de Sindicâncias e IPM com taxa de
// conclusão de cada um, mais o total geral de PA cadastrados/finalizados.
// As listas detalhadas (processos em curso/atrasados) continuam nos
// relatórios dedicados exportSindicanciasPdf/exportIPMPdf — este é só um
// retrato rápido pra quem está de fora.
export function exportIndicadoresPAPdf(processosTodos: Processo[]) {
  const processos = processosTodos.filter((p) => setorDe(p) === "PA");
  const total = processos.length;
  const concluidos = processos.filter(ehConcluido).length;

  const sindicancias = processos.filter(isSindicancia);
  const sindicanciasConcluidas = sindicancias.filter(ehConcluido).length;

  const ipm = processos.filter(isIPM);
  const ipmConcluidos = ipm.filter(ehConcluido).length;

  const doc = buildBasePdf(
    "Indicadores de Gestão - Processos Administrativos",
    "Resumo consolidado de produtividade do acervo de PA",
  );

  autoTable(doc, {
    startY: 36,
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de processos PA cadastrados", String(total)],
      ["Processos PA finalizados", String(concluidos)],
      ["Taxa de conclusão geral", formatarPercentual(concluidos, total)],
      ["Total de Sindicâncias", String(sindicancias.length)],
      ["Taxa de conclusão (Sindicâncias)", formatarPercentual(sindicanciasConcluidas, sindicancias.length)],
      ["Total de IPM", String(ipm.length)],
      ["Taxa de conclusão (IPM)", formatarPercentual(ipmConcluidos, ipm.length)],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [26, 86, 219] },
  });

  doc.save("indicadores-pa.pdf");
}

function exportTipoPA(processos: Processo[], tipo: "sindicancia" | "ipm") {
  const titulo =
    tipo === "sindicancia"
      ? "Relatório - Sindicâncias em Curso e Atrasadas"
      : "Relatório - IPM em Curso e Atrasados";
  const subtitulo =
    tipo === "sindicancia"
      ? "Controle de sindicâncias ativas e com atraso de prazo"
      : "Controle de IPM ativos e com atraso de prazo";

  const matcher = tipo === "sindicancia" ? isSindicancia : isIPM;

  const base = processos.filter((p) => p.tipo === "PA" && matcher(p));
  const emCurso = base
    .filter((p) => !ehConcluido(p) && !isAtrasado(p))
    .sort((a, b) => diasParaOrdenacao(a) - diasParaOrdenacao(b));
  const atrasadas = base
    .filter((p) => !ehConcluido(p) && isAtrasado(p))
    .sort((a, b) => diasParaOrdenacao(a) - diasParaOrdenacao(b));
  const totalAtivas = emCurso.length + atrasadas.length;
  const atrasadasEncarregado = atrasadas.filter((p) => motivoAtraso(p) === "Encarregado").length;
  const atrasadasAssessor = atrasadas.filter((p) => motivoAtraso(p) === "Assessor (Solução)").length;

  const doc = buildBasePdf(titulo, subtitulo);

  autoTable(doc, {
    startY: 36,
    head: [["Métrica", "Valor"]],
    body: [
      ["Total mapeado", String(base.length)],
      ["Em curso", String(emCurso.length)],
      ["Atrasadas", String(atrasadas.length)],
      ["  - Atraso com o Encarregado (não concluiu / prorrogação)", String(atrasadasEncarregado)],
      ["  - Atraso com o Assessor (confecção da solução)", String(atrasadasAssessor)],
      [
        "Taxa de atraso",
        totalAtivas > 0 ? `${Math.round((atrasadas.length / totalAtivas) * 100)}%` : "0%",
      ],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [26, 86, 219] },
  });

  const emCursoRows = emCurso.map((p) => {
    return [
      p.numero || "-",
      p.interessado || p.cliente || "-",
      p.encarregado || "-",
      p.responsavel || "-",
      formatDate(p.criadoEm || p.dataEntrada),
      formatDate(prazoReferencia(p)),
    ];
  });

  const atrasadasRows = atrasadas.map((p) => {
    return [
      p.numero || "-",
      p.interessado || p.cliente || "-",
      p.encarregado || "-",
      p.responsavel || "-",
      formatDate(p.criadoEm || p.dataEntrada),
      formatDate(prazoReferencia(p)),
      motivoAtraso(p),
    ];
  });

  // `atrasadas` já vem ordenada do mais atrasado para o menos atrasado
  // (diasParaOrdenacao ascendente = mais dias negativos primeiro).
  const atrasadasAssessorRows = atrasadas
    .filter((p) => motivoAtraso(p) === "Assessor (Solução)")
    .map((p) => {
      const dias = diasParaOrdenacao(p);
      return [
        p.numero || "-",
        p.interessado || p.cliente || "-",
        p.responsavel || "-",
        formatDate(prazoReferencia(p)),
        Number.isFinite(dias) ? String(Math.abs(dias)) : "-",
      ];
    });

  const firstTableY = proximoY(doc, 92);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Processos em curso", 14, firstTableY);

  autoTable(doc, {
    startY: firstTableY + 2,
    head: [["Processo", "Interessado", "Encarregado", "Responsável", "Entrada", "Prazo"]],
    body: emCursoRows.length > 0
      ? emCursoRows
      : [["-", "-", "-", "-", "-", "Sem registros em curso"]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  const secondTableY = proximoY(doc, firstTableY + 50);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Processos em atraso", 14, secondTableY);

  autoTable(doc, {
    startY: secondTableY + 2,
    head: [["Processo", "Interessado", "Encarregado", "Responsável", "Entrada", "Prazo", "Atraso por"]],
    body: atrasadasRows.length > 0
      ? atrasadasRows
      : [["-", "-", "-", "-", "-", "-", "Sem registros em atraso"]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [176, 55, 55] },
  });

  const thirdTableY = proximoY(doc, secondTableY + 50);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Atrasados com Assessor (Confecção da solução)", 14, thirdTableY);

  autoTable(doc, {
    startY: thirdTableY + 2,
    head: [["Processo", "Interessado", "Responsável", "Prazo", "Dias em atraso"]],
    body: atrasadasAssessorRows.length > 0
      ? atrasadasAssessorRows
      : [["-", "-", "-", "-", "Sem registros"]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [245, 200, 30], textColor: [40, 40, 40] },
    bodyStyles: { fillColor: [255, 249, 219] },
    alternateRowStyles: { fillColor: [255, 244, 189] },
  });

  doc.save(tipo === "sindicancia" ? "indicadores-sindicancias.pdf" : "indicadores-ipm.pdf");
}

export function exportSindicanciasPdf(processos: Processo[]) {
  exportTipoPA(processos, "sindicancia");
}

export function exportIPMPdf(processos: Processo[]) {
  exportTipoPA(processos, "ipm");
}

function sanitizarNomeArquivo(texto: string) {
  return normalizeText(texto).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "processos";
}

// Mesmo mini-resumo por template usado nos cards do dashboard (ver
// src/components/CardDU.tsx e CardPA.tsx) — aqui só decide qual gerador usar
// a partir do setor do processo, já que o PDF mistura DU e PA na mesma busca.
function resumoDoProcesso(p: Processo): string {
  const setor = (p.setor || p.tipo || "").toString().trim().toUpperCase();
  return setor === "PA" ? gerarResumoPA(p) : gerarResumoDU(p);
}

export function exportResultadosBuscaPdf(processos: Processo[], termoBusca: string) {
  // Mais recentes primeiro. Processos sem data de entrada vão para o fim,
  // em vez de embolar a ordenação vindo como "maior" data (NaN).
  const ordenados = [...processos].sort((a, b) => {
    const tA = a.dataEntrada ? new Date(a.dataEntrada).getTime() : Number.NEGATIVE_INFINITY;
    const tB = b.dataEntrada ? new Date(b.dataEntrada).getTime() : Number.NEGATIVE_INFINITY;
    return tB - tA;
  });

  const rows = ordenados.map((p) => [
    formatDate(p.dataEntrada),
    p.numero || "-",
    p.tipoAcao || "-",
    ehConcluido(p) ? "Sim" : "Não",
    resumoDoProcesso(p),
  ]);

  // Paisagem: a coluna de Resumo precisa de mais largura do que o A4 retrato
  // comporta sem espremer as demais colunas.
  const doc = buildBasePdf(
    "Resultado de Busca",
    `Termo pesquisado: "${termoBusca}" - ${processos.length} processo(s) encontrado(s)`,
    "l",
  );

  autoTable(doc, {
    startY: 36,
    head: [["Data de Entrada", "Número do Processo", "Assunto", "Finalizado", "Resumo"]],
    body: rows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" },
    headStyles: { fillColor: [14, 43, 85] },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 40 },
      2: { cellWidth: 45 },
      3: { cellWidth: 20 },
      4: { cellWidth: "auto" },
    },
  });

  doc.save(`busca-${sanitizarNomeArquivo(termoBusca)}.pdf`);
}
