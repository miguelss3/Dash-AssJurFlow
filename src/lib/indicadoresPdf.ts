import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Processo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

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

function prazoReferencia(p: Processo) {
  return p.prazo || p.finalPrazo || p.prazoFatal;
}

function isAtrasado(p: Processo) {
  return p.status !== "concluido" && statusPrazo(prazoReferencia(p)) === "overdue";
}

function buildBasePdf(title: string, subtitle: string) {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const generatedAt = new Date().toLocaleString("pt-BR");

  doc.setFillColor(14, 43, 85);
  doc.rect(0, 0, 210, 30, "F");
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

export function exportIndicadoresGeraisPdf(processos: Processo[]) {
  const total = processos.length;
  const concluidos = processos.filter((p) => p.status === "concluido").length;
  const ativos = total - concluidos;
  const atrasados = processos.filter(isAtrasado).length;
  const percentualConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const statusRows = ["novo", "andamento", "concluido"].map((status) => {
    const quantidade = processos.filter((p) => p.status === status).length;
    const percentual = total > 0 ? `${Math.round((quantidade / total) * 100)}%` : "0%";
    return [status.toUpperCase(), String(quantidade), percentual];
  });

  const doc = buildBasePdf(
    "Indicadores de Gestao - Estatisticas",
    "Resumo consolidado de produtividade e distribuicao do acervo",
  );

  autoTable(doc, {
    startY: 36,
    head: [["Metrica", "Valor"]],
    body: [
      ["Total de processos cadastrados", String(total)],
      ["Processos finalizados", String(concluidos)],
      ["Processos ativos", String(ativos)],
      ["Processos atrasados", String(atrasados)],
      ["Taxa de conclusao", `${percentualConclusao}%`],
    ],
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [26, 86, 219] },
  });

  autoTable(doc, {
    startY: (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      : 92,
    head: [["Status", "Quantidade", "% do total"]],
    body: statusRows,
    theme: "striped",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  doc.save("indicadores-estatisticas.pdf");
}

function exportTipoPA(processos: Processo[], tipo: "sindicancia" | "ipm") {
  const titulo =
    tipo === "sindicancia"
      ? "Relatorio - Sindicancias em Curso e Atrasadas"
      : "Relatorio - IPM em Curso e Atrasados";
  const subtitulo =
    tipo === "sindicancia"
      ? "Controle de sindicancias ativas e com atraso de prazo"
      : "Controle de IPM ativos e com atraso de prazo";

  const matcher = tipo === "sindicancia" ? isSindicancia : isIPM;

  const base = processos.filter((p) => p.tipo === "PA" && matcher(p));
  const emCurso = base.filter((p) => p.status !== "concluido" && !isAtrasado(p));
  const atrasadas = base.filter((p) => p.status !== "concluido" && isAtrasado(p));
  const totalAtivas = emCurso.length + atrasadas.length;

  const doc = buildBasePdf(titulo, subtitulo);

  autoTable(doc, {
    startY: 36,
    head: [["Metrica", "Valor"]],
    body: [
      ["Total mapeado", String(base.length)],
      ["Em curso", String(emCurso.length)],
      ["Atrasadas", String(atrasadas.length)],
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
    ];
  });

  const firstTableY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ?.finalY
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    : 92;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Processos em curso", 14, firstTableY);

  autoTable(doc, {
    startY: firstTableY + 2,
    head: [["Processo", "Interessado", "Encarregado", "Responsavel", "Entrada", "Prazo"]],
    body: emCursoRows.length > 0
      ? emCursoRows
      : [["-", "-", "-", "-", "-", "Sem registros em curso"]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [14, 43, 85] },
  });

  const secondTableY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
    ?.finalY
    ? (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    : firstTableY + 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Processos em atraso", 14, secondTableY);

  autoTable(doc, {
    startY: secondTableY + 2,
    head: [["Processo", "Interessado", "Encarregado", "Responsavel", "Entrada", "Prazo"]],
    body: atrasadasRows.length > 0
      ? atrasadasRows
      : [["-", "-", "-", "-", "-", "Sem registros em atraso"]],
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [176, 55, 55] },
  });

  doc.save(tipo === "sindicancia" ? "indicadores-sindicancias.pdf" : "indicadores-ipm.pdf");
}

export function exportSindicanciasPdf(processos: Processo[]) {
  exportTipoPA(processos, "sindicancia");
}

export function exportIPMPdf(processos: Processo[]) {
  exportTipoPA(processos, "ipm");
}
