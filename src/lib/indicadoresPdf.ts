import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Processo } from "@/types/processo";
import { statusPrazo, diasRestantes } from "@/lib/prazo";
import { gerarResumoDU, gerarResumoPA } from "@/lib/resumoProcesso";

type Html2CanvasModule = {
  default?: (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;
  (element: HTMLElement, options?: Record<string, unknown>): Promise<HTMLCanvasElement>;
};

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
// de grafia do mesmo assunto.
function assuntoIndicePrincipal(value?: string): string {
  const texto = String(value || "Outros").trim();
  if (!texto) return "Outros";
  const [principal] = texto.split(/\s[-–—]\s/);
  return (principal || texto).trim() || "Outros";
}

const LABEL_STATUS: Record<string, string> = {
  novo: "Triagem",
  andamento: "Em Andamento",
  concluido: "Concluído",
};

// V2 — Relatório pensado para circular fora da equipe (chefia, outras OMs):
// sem prazos/atrasos internos, com os números que dão uma visão geral de
// volume e produtividade (cadastros e conclusão mês a mês, assuntos mais
// recorrentes, composição DU/PA).
export function exportIndicadoresGeraisPdf(processos: Processo[]) {
  const total = processos.length;
  const concluidos = processos.filter(ehConcluido).length;
  const ativos = total - concluidos;
  const percentualConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const statusRows = ["novo", "andamento", "concluido"].map((status) => {
    const quantidade = processos.filter((p) => p.status === status).length;
    const percentual = total > 0 ? `${Math.round((quantidade / total) * 100)}%` : "0%";
    return [LABEL_STATUS[status], String(quantidade), percentual];
  });

  const setorDe = (p: Processo) => (p.setor || p.tipo || "").toString().trim().toUpperCase();
  const totalDU = processos.filter((p) => setorDe(p) === "DU").length;
  const totalPA = processos.filter((p) => setorDe(p) === "PA").length;

  // Cadastros e conclusão por mês — mesma janela de 6 meses do painel.
  const agora = new Date();
  const meses = Array.from({ length: 6 }).map((_, index) => {
    const ref = new Date(agora.getFullYear(), agora.getMonth() - (5 - index), 1);
    return {
      chave: `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`,
      rotulo: ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
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
  const mensalRows = meses.map((m) => {
    const b = porMes.get(m.chave) as { cadastrados: number; concluidos: number };
    const taxa = b.cadastrados > 0 ? `${Math.round((b.concluidos / b.cadastrados) * 100)}%` : "-";
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
    .map((item) => [
      item.nome,
      String(item.valor),
      total > 0 ? `${Math.round((item.valor / total) * 100)}%` : "0%",
    ]);

  const doc = buildBasePdf(
    "Indicadores de Gestão - Estatísticas",
    "Resumo consolidado de produtividade e distribuição do acervo",
  );

  autoTable(doc, {
    startY: 36,
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de processos cadastrados", String(total)],
      ["Processos finalizados", String(concluidos)],
      ["Processos ativos", String(ativos)],
      ["Taxa de conclusão geral", `${percentualConclusao}%`],
      ["Processos DU", String(totalDU)],
      ["Processos PA", String(totalPA)],
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

  const yMensal = proximoY(doc, 150);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Cadastros e Conclusão por Mês", 14, yMensal);
  autoTable(doc, {
    startY: yMensal + 2,
    head: [["Mês", "Registrados", "Concluídos", "Taxa de Conclusão"]],
    body: mensalRows,
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  const yAssuntos = proximoY(doc, 220);
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

  doc.save("indicadores-estatisticas.pdf");
}

export async function exportIndicadoresGeraisPdfFromElement(element: HTMLElement) {
  const imported = (await import("html2canvas")) as Html2CanvasModule;
  const html2canvas = imported.default ?? imported;

  if (typeof html2canvas !== "function") {
    throw new Error("html2canvas não disponível em runtime");
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${element.scrollWidth}px`;
  clone.style.background = "white";
  clone.style.padding = "12px";
  clone.querySelectorAll('[data-print-ignore="true"]').forEach((node) => node.remove());

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${element.scrollWidth + 24}px`;
  wrapper.style.background = "white";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(clone, {
      scale: 1.6,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight,
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error("Falha ao capturar área de indicadores");
    }

    const imgData = canvas.toDataURL("image/png", 1);
    const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Cabeçalho igual ao padrão anterior
    doc.setFillColor(14, 43, 85);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Indicadores de Gestão - Estatísticas", 14, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Painel completo dos indicadores exibidos em tela", 14, 20);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 25);

    const marginX = 8;
    const startY = 36;
    const usableWidth = pageWidth - marginX * 2;
    const usableHeight = pageHeight - startY - 8;
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let yRemaining = imgHeight;
    let position = startY;

    doc.setTextColor(20, 20, 20);
    doc.addImage(imgData, "PNG", marginX, position, imgWidth, imgHeight);
    yRemaining -= usableHeight;

    while (yRemaining > 0) {
      position = yRemaining - imgHeight + startY;
      doc.addPage();
      doc.addImage(imgData, "PNG", marginX, position, imgWidth, imgHeight);
      yRemaining -= usableHeight;
    }

    doc.save("indicadores-estatisticas-geral.pdf");
  } finally {
    document.body.removeChild(wrapper);
  }
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
