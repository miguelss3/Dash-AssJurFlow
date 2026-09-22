// Segundo caminho de injeção do botão, redundante com "content_scripts" no
// manifest.json. A injeção declarativa (content_scripts) às vezes não pega
// num F5 dentro do SPED — este listener é mais direto: sempre que uma aba
// do SPED terminar de carregar, injeta extrator.js + content.js na hora.
// content.js já se protege contra injeção duplicada (não cria um segundo
// botão nem um segundo observer se já houver um rodando na página).

const PADRAO_URL_SPED = /^https?:\/\/sped\.12rm\.eb\.mil\.br\//i;

function injetarNaAba(tabId) {
  chrome.scripting
    .executeScript({ target: { tabId }, files: ["extrator.js", "content.js"] })
    .catch((err) => {
      console.warn("[AssJurFlow] Falha ao injetar o botão na aba", tabId, err);
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  const url = tab?.url || changeInfo.url || "";
  if (PADRAO_URL_SPED.test(url)) {
    injetarNaAba(tabId);
  }
});
