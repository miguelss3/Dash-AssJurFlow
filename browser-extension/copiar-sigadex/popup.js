const btn = document.getElementById("btn-copiar");
const status = document.getElementById("status");

function setStatus(texto, tipo) {
  status.textContent = texto;
  status.className = tipo || "";
}

// extrairTextoDaPagina vem de extrator.js (carregado antes deste script no
// popup.html). chrome.scripting.executeScript serializa o CORPO da função e
// injeta na página de destino — não importa que ela tenha sido definida num
// arquivo separado, só que esteja disponível aqui no escopo do popup.
// copiarParaAreaDeTransferencia também vem de extrator.js — roda aqui no
// contexto do popup (não injetada), então só precisa estar carregada.
btn.addEventListener("click", async () => {
  setStatus("Lendo documento...", "");
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("Aba ativa não encontrada.");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extrairTextoDaPagina,
    });

    if (!result || result.erro) {
      setStatus(
        result?.erro || "Nenhum documento PDF.js encontrado nesta aba. Abra o documento antes de clicar.",
        "erro",
      );
      return;
    }
    if (!result.texto) {
      setStatus("O documento parece vazio.", "erro");
      return;
    }

    const copiou = await copiarParaAreaDeTransferencia(result.texto);
    if (!copiou) throw new Error("Não foi possível gravar na área de transferência.");
    setStatus("Copiado! Agora é só colar no AssJurFlow.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(`Erro ao copiar: ${err?.message || err}`, "erro");
  } finally {
    btn.disabled = false;
  }
});
