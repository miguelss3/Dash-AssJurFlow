// Compartilhado entre popup.js (via chrome.scripting.executeScript, que
// serializa e injeta esta função na página de destino) e content.js (que
// roda direto na página do SPED, chamando a função sem indireção nenhuma).
// Por isso precisa ser 100% autocontida — nada de referenciar variável de
// fora do próprio corpo da função.
//
// Descoberta-chave (confirmada span a span num DIEx real): dentro da MESMA
// linha (mesmo "top"), o texto de cada span já vem com os espaços corretos
// embutidos — o PDF.js preserva isso certinho, desde que os spans estejam
// "encostados" (a frase realmente continua de um span pro outro). O espaço
// só se perde em dois pontos:
//   1) na quebra de linha (quando o "top" muda), porque o PDF de origem não
//      grava nenhum caractere ali, só reposiciona visualmente;
//   2) quando dois blocos independentes dividem a mesma linha só por
//      coincidência de layout (ex.: "URGENTE" à esquerda e a data à direita,
//      no cabeçalho) — aí sobra um vão horizontal grande entre o fim de um
//      span e o início do outro, mesmo com "top" igual.
// Por isso a régua usa duas medidas: "top" diferente -> insere espaço (ou
// linha em branco, se o salto for bem maior que uma linha normal,
// sinalizando novo parágrafo); mesmo "top" mas vão horizontal grande
// (offsetWidth real, só disponível rodando na página de verdade) -> também
// insere espaço, mesmo sem mudar de linha.
function extrairTextoDaPagina() {
  const paginasEls = Array.from(document.querySelectorAll(".page"))
    .filter((el) => el.querySelector(".textLayer"))
    .sort((a, b) => Number(a.dataset.pageNumber || 0) - Number(b.dataset.pageNumber || 0));

  const camadas =
    paginasEls.length > 0
      ? paginasEls.map((p) => p.querySelector(".textLayer"))
      : Array.from(document.querySelectorAll(".textLayer"));

  if (camadas.length === 0) {
    return { erro: "Nenhum documento PDF.js encontrado nesta aba." };
  }

  const LIMIAR_PARAGRAFO_PX = 24;
  const LIMIAR_VAO_MESMA_LINHA_PX = 20;
  let resultado = "";

  camadas.forEach((camada, idxPagina) => {
    const spans = Array.from(camada.querySelectorAll("span"));
    let anterior = null; // { top, right }

    spans.forEach((span) => {
      const texto = span.textContent || "";
      if (!texto) return;

      const top = parseFloat(span.style.top) || 0;
      const left = parseFloat(span.style.left) || 0;
      const largura = span.offsetWidth || 0;

      if (!anterior) {
        resultado += texto;
      } else if (Math.abs(top - anterior.top) < 0.5) {
        const vao = left - anterior.right;
        resultado += (vao > LIMIAR_VAO_MESMA_LINHA_PX ? " " : "") + texto;
      } else {
        const salto = top - anterior.top;
        resultado += (salto > LIMIAR_PARAGRAFO_PX ? "\n\n" : " ") + texto;
      }

      anterior = { top, right: left + largura };
    });

    if (idxPagina < camadas.length - 1) resultado += "\n\n";
  });

  // Recorte do miolo útil: um DIEx sempre tem o mesmo esqueleto (brasão/
  // unidade -> "DIEx nº ..." -> [URGENTE] -> Da/Ao -> Assunto/Anexos/corpo ->
  // "Atenciosamente," -> assinatura/lema/rodapé de página). Só o miolo
  // (Assunto em diante) interessa pro cadastro — o resto é reconhecível por
  // padrões fixos do próprio texto, não por posição, então funciona em
  // qualquer DIEx, não só neste. Se os marcadores não forem encontrados,
  // devolve o texto inteiro sem cortar nada (evita apagar conteúdo à toa).
  const paragrafos = resultado
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const idxInicio = paragrafos.findIndex((p) => /^(DIEx|Of[ií]cio)\s*n[ºo°]/i.test(p));
  const desdeDiex = idxInicio >= 0 ? paragrafos.slice(idxInicio) : paragrafos;

  const idxFim = desdeDiex.findIndex((p) => /^(Atenciosamente|Respeitosamente|Cordialmente)\b/i.test(p));
  const corpo = idxFim >= 0 ? desdeDiex.slice(0, idxFim) : desdeDiex;

  const filtrado = corpo.filter((p) => {
    if (/^URGENTE\b/i.test(p)) return false; // marcador de prioridade
    if (/^D[ao]\s/i.test(p)) return false; // "Da"/"Do" (remetente)
    if (/^Ao(s)?\s/i.test(p)) return false; // "Ao"/"Aos" (destinatário)
    return true;
  });

  return { texto: filtrado.join("\n\n").trim() };
}

// Copia para a área de transferência com fallback universal. O Firefox não
// expõe `navigator.clipboard` da mesma forma dentro de content scripts (dá
// "navigator.clipboard is undefined"), então tenta a API moderna primeiro e,
// se não existir ou falhar, cai no truque clássico de textarea temporário +
// document.execCommand("copy") — funciona em qualquer navegador.
async function copiarParaAreaDeTransferencia(texto) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // cai no fallback abaixo
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = texto;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(textarea);
  return ok;
}
