// Roda automaticamente nas páginas do SPED (ver "matches" no manifest.json).
// Injeta um botão flutuante fixo no canto da tela; ao clicar, extrai e
// corrige o texto do documento aberto (extrairTextoDaPagina, de
// extrator.js) e copia para a área de transferência — sem precisar abrir o
// ícone da extensão.

(function iniciar() {
  const ID_BOTAO = "assjurflow-btn-copiar";

  function criarBotao() {
    const botao = document.createElement("button");
    botao.id = ID_BOTAO;
    botao.type = "button";
    botao.textContent = "Copiar p/ AssJurFlow";
    Object.assign(botao.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "2147483647", // acima de qualquer coisa da própria página
      padding: "12px 18px",
      borderRadius: "999px",
      border: "none",
      background: "#0F172A",
      color: "#ffffff",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: "13px",
      fontWeight: "700",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.35)",
      cursor: "pointer",
      transition: "background 0.15s ease, transform 0.1s ease",
    });
    botao.addEventListener("mouseenter", () => { botao.style.background = "#1E293B"; });
    botao.addEventListener("mouseleave", () => { botao.style.background = "#0F172A"; });
    botao.addEventListener("mousedown", () => { botao.style.transform = "scale(0.97)"; });
    botao.addEventListener("mouseup", () => { botao.style.transform = "scale(1)"; });

    const textoOriginal = botao.textContent;
    let restaurarTimer = null;

    function mostrarFeedback(texto, corFundo) {
      botao.textContent = texto;
      botao.style.background = corFundo;
      if (restaurarTimer) clearTimeout(restaurarTimer);
      restaurarTimer = setTimeout(() => {
        botao.textContent = textoOriginal;
        botao.style.background = "#0F172A";
      }, 2200);
    }

    botao.addEventListener("click", async () => {
      botao.disabled = true;
      try {
        const resultado = extrairTextoDaPagina();
        if (!resultado || resultado.erro) {
          mostrarFeedback(resultado?.erro || "Nenhum documento encontrado", "#B91C1C");
          return;
        }
        if (!resultado.texto) {
          mostrarFeedback("Documento vazio", "#B91C1C");
          return;
        }
        const copiou = await copiarParaAreaDeTransferencia(resultado.texto);
        mostrarFeedback(copiou ? "Copiado!" : "Erro ao copiar", copiou ? "#047857" : "#B91C1C");
      } catch (err) {
        console.error("[AssJurFlow] Erro ao copiar documento:", err);
        mostrarFeedback("Erro ao copiar", "#B91C1C");
      } finally {
        botao.disabled = false;
      }
    });

    return botao;
  }

  // Garante que o botão exista mesmo se a página (SPA/Angular) recriar o
  // <body> ou remover o botão em algum re-render — reinsere sozinho.
  function garantirBotao() {
    if (!document.body || document.getElementById(ID_BOTAO)) return;
    document.body.appendChild(criarBotao());
  }

  garantirBotao();

  const observer = new MutationObserver(() => garantirBotao());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
