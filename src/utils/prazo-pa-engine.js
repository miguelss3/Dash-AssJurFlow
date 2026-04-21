import { USUARIO_LOGADO } from "../core/app-state.js";

export function initPrazoPAEngine({
  state,
  $,
  on,
  salvarProcessos,
  showToast,
  adicionarMensagemSistema,
  refreshAll,
  nomeMilitarCurto,
}) {
  let processoAtualId = null;

  function salvarSnapshotUltimaAcao(p, descricao = "Alteração de prazo") {
    if (!p) return;
    const snapshot = JSON.parse(JSON.stringify(p));
    delete snapshot.ultimaAcaoSnapshot;
    delete snapshot.ultimaAcaoDescricao;
    delete snapshot.ultimaAcaoEm;
    p.ultimaAcaoSnapshot = snapshot;
    p.ultimaAcaoDescricao = descricao;
    p.ultimaAcaoEm = new Date().toISOString();
  }

  function salvarSnapshotUltimaAcao(p, descricao = "Alteração de prazo") {
    if (!p) return;
    const snapshot = JSON.parse(JSON.stringify(p));
    delete snapshot.ultimaAcaoSnapshot;
    delete snapshot.ultimaAcaoDescricao;
    delete snapshot.ultimaAcaoEm;
    p.ultimaAcaoSnapshot = snapshot;
    p.ultimaAcaoDescricao = descricao;
    p.ultimaAcaoEm = new Date().toISOString();
  }

  function getProcessoAtual() {
    return state.processos.find((p) => p.id === processoAtualId);
  }

  function ensureCamposPrazo(p) {
    if (!Array.isArray(p.prorrogacoes)) p.prorrogacoes = [];
    if (!p.substituicaoEncarregado || typeof p.substituicaoEncarregado !== "object") {
      p.substituicaoEncarregado = {};
    }
    if (!Array.isArray(p.substituicoesEncarregado)) p.substituicoesEncarregado = [];
    p.dataInicialPrazoSolucao = p.dataInicialPrazoSolucao || "";
    p.prazoSolucaoDias = Number(p.prazoSolucaoDias || 10);
    p.prazoSolucaoIniciadoPorNome = p.prazoSolucaoIniciadoPorNome || "";

    p.substituicaoEncarregado = {
      houve: p.substituicaoEncarregado.houve || "Não",
      data: p.substituicaoEncarregado.data || "",
      motivo: p.substituicaoEncarregado.motivo || "",
      novoEncarregado: p.substituicaoEncarregado.novoEncarregado || "",
      postoNovoEncarregado: p.substituicaoEncarregado.postoNovoEncarregado || "",
      nomeNovoEncarregado: p.substituicaoEncarregado.nomeNovoEncarregado || "",
      numeroPublicacao: p.substituicaoEncarregado.numeroPublicacao || "",
      alterouPortaria: p.substituicaoEncarregado.alterouPortaria || "Não",
      novaPortaria: p.substituicaoEncarregado.novaPortaria || "",
      encarregadoAnterior: p.substituicaoEncarregado.encarregadoAnterior || p.encarregado || "",
      portariaAnterior: p.substituicaoEncarregado.portariaAnterior || p.numeroProcesso || "",
      registradoPorNome: p.substituicaoEncarregado.registradoPorNome || "",
      criadoEm: p.substituicaoEncarregado.criadoEm || "",
    };

    if (
      p.substituicaoEncarregado.houve === "Sim" &&
      !p.substituicoesEncarregado.length &&
      (p.substituicaoEncarregado.novoEncarregado || p.substituicaoEncarregado.motivo || p.substituicaoEncarregado.numeroPublicacao)
    ) {
      p.substituicoesEncarregado.push({
        ...p.substituicaoEncarregado,
        id: crypto.randomUUID(),
      });
    }
  }

  function separarPostoNome(valor) {
    const texto = String(valor || "").trim();
    const postos = ["Sgt", "Ten", "Cap", "Maj", "TC", "Cel"];
    const posto = postos.find((p) => texto === p || texto.startsWith(`${p} `)) || "";
    return {
      posto,
      nome: posto ? texto.slice(posto.length).trim() : texto,
    };
  }

  function extrairNumeroPortaria(valor) {
    const texto = String(valor || "").trim();
    const match = texto.match(/(\d+)/);
    return match ? match[1] : "";
  }

  function montarPortariaComAno(numero) {
    const apenasNumero = String(numero || "").replace(/\D/g, "");
    if (!apenasNumero) return "";
    const anoAtual = new Date().getFullYear();
    return `${apenasNumero}/${anoAtual}`;
  }

  function normalizarTexto(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function isSindicancia(p) {
    return normalizarTexto(p?.tipoPA).includes("sindic");
  }

  function calcPrazoFinalIso(p) {
    if (!p?.portariaAssinadaEm || !p?.dataInicialPrazo) return "";

    let base = 30;
    let incr = 30;

    if (normalizarTexto(p?.tipoPA).includes("ipm")) {
      base = p.emDiligencia ? 20 : 40;
      incr = 20;
    }

    const totalDias = base + (p.prorrogacoes?.length || 0) * incr;
    const partes = p.dataInicialPrazo.split("-").map(Number);
    if (partes.length !== 3) return "";

    const [y, m, d] = partes;
    if (!y || !m || !d) return "";

    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + totalDias);

    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function calcPrazoFinal(p) {
    const iso = calcPrazoFinalIso(p);
    if (!iso) return "—";
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
  }

  function calcPrazoSolucaoFinalIso(p) {
    if (!p?.dataInicialPrazoSolucao) return "";
    const partes = p.dataInicialPrazoSolucao.split("-").map(Number);
    if (partes.length !== 3) return "";

    const [y, m, d] = partes;
    if (!y || !m || !d) return "";

    const dias = Number(p.prazoSolucaoDias || 10);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + dias);

    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function calcPrazoSolucaoFinal(p) {
    const iso = calcPrazoSolucaoFinalIso(p);
    if (!iso) return "—";
    return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
  }

  function prazoPrincipalVencido(p) {
    const iso = calcPrazoFinalIso(p);
    if (!iso) return false;

    const limite = new Date(`${iso}T23:59:59`);
    return Date.now() > limite.getTime();
  }

  function marcarCienciaAdmin(p, descricao = "") {
    p.notificacaoAdminPendente = true;
    p.notificacaoAdminEm = new Date().toISOString();
    p.notificacaoAdminPorNome = nomeMilitarCurto?.(USUARIO_LOGADO) || "Assessor";
    p.notificacaoAdminDescricao = descricao;
  }

  function abrirModalPrazoPA(processoId) {
    processoAtualId = processoId;
    const p = getProcessoAtual();
    if (!p) return;

    ensureCamposPrazo(p);

    $("lblProcessoPrazo").textContent = p.numeroProcesso || p.nup || "Processo";
    
    let baseText = p.tipoPA === "IPM" ? (p.emDiligencia ? "20 dias (Diligência)" : "40 dias (Base)") : "30 dias";
    $("lblTipoPrazo").textContent = `${p.tipoPA || "PA"} • Prazo Inicial: ${baseText}`;
    
    if ($("inputDataInicialPrazo")) $("inputDataInicialPrazo").value = p.dataInicialPrazo || "";

    renderDetalhes();
    $("modalPrazoPA")?.classList.remove("hidden");
    $("modalPrazoPA")?.classList.add("flex");
    if (window.lucide) window.lucide.createIcons();
  }

  function fecharModalPrazoPA() {
    $("modalPrazoPA")?.classList.add("hidden");
    $("modalPrazoPA")?.classList.remove("flex");
    processoAtualId = null;
  }

  function renderDetalhes() {
    const p = getProcessoAtual();
    if (!p) return;
    ensureCamposPrazo(p);

    const scrollBody = document.querySelector("#modalPrazoPA .overflow-y-auto");
    if (!scrollBody) return;

    let extra = $("prazoPAExtra");
    if (!extra) {
      extra = document.createElement("div");
      extra.id = "prazoPAExtra";
      extra.className = "space-y-4 mt-4";
      scrollBody.appendChild(extra);
    }

    const prazoFinal = calcPrazoFinal(p);
    const prazoSolucaoFinal = calcPrazoSolucaoFinal(p);
    const alertaPrazoSolucao = isSindicancia(p) && prazoPrincipalVencido(p) && !p.dataInicialPrazoSolucao;
    const pr = p.prorrogacoes || [];
    const sub = p.substituicaoEncarregado || {
      houve: "Não",
      data: "",
      motivo: "",
      novoEncarregado: "",
      numeroPublicacao: "",
      alterouPortaria: "Não",
      novaPortaria: "",
      encarregadoAnterior: p.encarregado || "",
      portariaAnterior: p.numeroProcesso || "",
    };

    extra.innerHTML = `
      <div class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-800 space-y-1">
        <p><strong>Prorrogações Registadas:</strong> ${pr.length}</p>
        <p><strong>Prazo Final Estimado:</strong> <span class="font-black text-sm">${prazoFinal}</span></p>
        ${isSindicancia(p) ? `<p><strong>Prazo para Solução:</strong> ${p.dataInicialPrazoSolucao ? `Iniciado em ${new Date(p.dataInicialPrazoSolucao + "T00:00:00").toLocaleDateString("pt-BR")}` : (alertaPrazoSolucao ? `<span class="font-black text-rose-700">Prazo vencido — inicie a solução ou registre nova prorrogação.</span>` : "Aguardando encerramento do prazo principal.")}</p>` : ""}
        ${p.dataInicialPrazoSolucao ? `<p><strong>Fim do Prazo para Solução:</strong> <span class="font-black text-sm">${prazoSolucaoFinal}</span></p>` : ""}
      </div>

      <div class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-sm font-bold text-slate-700">Prorrogações</h4>
        </div>
        <div class="space-y-2">
          ${
            pr.length
              ? pr
                  .map(
                    (x, i) => `
            <div class="text-xs border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col gap-1">
              <div><span class="font-bold text-slate-700">${i + 1}ª prorrogação</span> • a partir de ${x.data ? new Date(x.data + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data"}</div>
              ${x.motivo ? `<div class="text-slate-500 italic">"${x.motivo}"</div>` : ""}
            </div>`
                  )
                  .join("")
              : `<p class="text-xs text-slate-400">Nenhuma prorrogação registada.</p>`
          }
        </div>
        <div class="mt-4 border-t border-slate-100 pt-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Data de início</label>
              <input id="inputDataNovaProrrogacaoPA" type="date" class="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none" value="${new Date().toISOString().slice(0, 10)}" />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-600 uppercase mb-1">Motivo</label>
              <input id="inputMotivoNovaProrrogacaoPA" type="text" class="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none" placeholder="Opcional" />
            </div>
          </div>
          <div class="flex justify-end">
            <button id="btnAdicionarProrrogacao" class="text-xs font-bold px-3 py-2 rounded-lg bg-purple-600 text-white shadow-sm hover:bg-purple-700 transition-colors">
              + Nova Prorrogação
            </button>
          </div>
        </div>
      </div>

    `;

    $("btnAdicionarProrrogacao")?.addEventListener("click", () => {
      const p = getProcessoAtual();
      if(!p) return;

      const numPr = p.prorrogacoes.length + 1;

      if (p.tipoPA === "Sindicância") {
          let autoridade = "";
          if (numPr === 1) autoridade = "CHEM";
          else if (numPr === 2) autoridade = "Cmt 12RM";
          else {
              showToast("Uma Sindicância só permite 2 prorrogações legais.", "erro");
              return;
          }
          if (!confirm(`Confirmar a ${numPr}ª prorrogação de 30 dias?\n\n⚠️ ATENÇÃO: Aprovação prévia do(a) ${autoridade}.`)) return;
      } 
      else if (p.tipoPA === "IPM") {
          let autoridade = p.emDiligencia ? "MPM" : (numPr === 1 ? "Cmt 12RM" : "MPM");
          if (!confirm(`Confirmar a ${numPr}ª prorrogação de 20 dias?\n\n⚠️ ATENÇÃO: Aprovação a critério do(a) ${autoridade}.`)) return;
      }

      const data = $("inputDataNovaProrrogacaoPA")?.value || "";
      if (!data) {
        showToast("Selecione a data no calendário.", "erro");
        return;
      }
      const motivo = $("inputMotivoNovaProrrogacaoPA")?.value?.trim() || "";
      
      const nomeResponsavel = nomeMilitarCurto?.(USUARIO_LOGADO) || "Assessor";
      salvarSnapshotUltimaAcao(p, `${numPr}ª prorrogação`);
      p.prorrogacoes.push({ id: crypto.randomUUID(), data, motivo, criadoEm: new Date().toISOString(), registradoPorNome: nomeResponsavel });
      marcarCienciaAdmin(p, `${numPr}ª prorrogação lançada pelo assessor.`);
      salvarProcessos();
      adicionarMensagemSistema?.(p.id, `${numPr}ª prorrogação registada no sistema por ${nomeResponsavel}.`);
      renderDetalhes();
      refreshAll?.();
      showToast("Prorrogação adicionada!");
    });

  }

  function renderHistoricoSubstituicoesEncarregado(p) {
    const container = $("historicoSubstituicoesEncarregadoPA");
    if (!container) return;
    const lista = Array.isArray(p.substituicoesEncarregado) ? p.substituicoesEncarregado : [];
    if (!lista.length) {
      container.innerHTML = `<p class="text-slate-400">Nenhuma substituição registrada.</p>`;
      return;
    }
    container.innerHTML = lista
      .map((item, index) => `
        <div class="border border-slate-200 rounded-lg p-2.5 bg-white">
          <div class="font-bold text-slate-700">${index + 1}ª substituição — ${item.novoEncarregado || "—"}</div>
          <div class="text-slate-500">${item.data ? new Date(item.data + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data"}${item.registradoPorNome ? ` • por ${item.registradoPorNome}` : ""}</div>
        </div>
      `)
      .join("");
  }

  function prepararNovaSubstituicaoEncarregado() {
    const p = getProcessoAtual();
    if (!p) return;
    $("inputEncarregadoAtualSubstituicaoPA").value = p.encarregado || p.substituicaoEncarregado?.novoEncarregado || p.substituicaoEncarregado?.encarregadoAnterior || "";
    $("inputDataSubstituicaoPA").value = new Date().toISOString().slice(0, 10);
    $("inputNumeroPublicacaoSubstituicaoPA").value = "";
    $("inputMotivoSubstituicaoPA").value = "";
    $("selectAlterouPortariaSubstituicaoPA").value = "Não";
    $("inputNovaPortariaSubstituicaoPA").value = "";
    $("selectPostoNovoEncarregadoSubstituicaoPA").value = "";
    $("inputNomeNovoEncarregadoSubstituicaoPA").value = "";
    $("blocoNovaPortariaSubstituicaoPA")?.classList.add("hidden");
  }

  function abrirModalSubstituicaoEncarregado(processoId) {
    processoAtualId = processoId;
    const p = getProcessoAtual();
    if (!p) return;

    ensureCamposPrazo(p);
    const sub = p.substituicaoEncarregado;

    $("lblProcessoSubstituicaoPA").textContent = p.numeroProcesso || p.nup || "Processo";
    $("inputEncarregadoAtualSubstituicaoPA").value = p.encarregado || sub.encarregadoAnterior || "";
    $("inputDataSubstituicaoPA").value = sub.data || new Date().toISOString().slice(0, 10);
    const novo = separarPostoNome(sub.novoEncarregado || "");

    $("inputNumeroPublicacaoSubstituicaoPA").value = sub.numeroPublicacao || "";
    $("inputMotivoSubstituicaoPA").value = sub.motivo || "";
    $("selectAlterouPortariaSubstituicaoPA").value = sub.alterouPortaria || "Não";
    $("inputNovaPortariaSubstituicaoPA").value = extrairNumeroPortaria(sub.novaPortaria || "");
    $("lblAnoPortariaSubstituicaoPA").textContent = `/${new Date().getFullYear()}`;
    $("blocoNovaPortariaSubstituicaoPA")?.classList.toggle("hidden", (sub.alterouPortaria || "Não") !== "Sim");
    $("selectPostoNovoEncarregadoSubstituicaoPA").value = sub.postoNovoEncarregado || novo.posto || "";
    $("inputNomeNovoEncarregadoSubstituicaoPA").value = sub.nomeNovoEncarregado || novo.nome || "";
    renderHistoricoSubstituicoesEncarregado(p);

    $("modalSubstituicaoEncarregadoPA")?.classList.remove("hidden");
    $("modalSubstituicaoEncarregadoPA")?.classList.add("flex");
    if (window.lucide) window.lucide.createIcons();
  }

  function fecharModalSubstituicaoEncarregado() {
    $("modalSubstituicaoEncarregadoPA")?.classList.add("hidden");
    $("modalSubstituicaoEncarregadoPA")?.classList.remove("flex");
  }

  function salvarSubstituicaoEncarregado() {
    const p = getProcessoAtual();
    if (!p) return;

    ensureCamposPrazo(p);

    const postoNovoEncarregado = $("selectPostoNovoEncarregadoSubstituicaoPA")?.value?.trim() || "";
    const nomeNovoEncarregado = $("inputNomeNovoEncarregadoSubstituicaoPA")?.value?.trim() || "";
    const novoEncarregado = `${postoNovoEncarregado} ${nomeNovoEncarregado}`.trim();
    const data = $("inputDataSubstituicaoPA")?.value || "";
    const numeroPublicacao = $("inputNumeroPublicacaoSubstituicaoPA")?.value?.trim() || "";
    const motivo = $("inputMotivoSubstituicaoPA")?.value?.trim() || "";
    const alterouPortaria = $("selectAlterouPortariaSubstituicaoPA")?.value || "Não";
    const novaPortariaNumero = $("inputNovaPortariaSubstituicaoPA")?.value?.trim() || "";
    const novaPortaria = montarPortariaComAno(novaPortariaNumero);

    if (!nomeNovoEncarregado) {
      showToast("Informe o nome do novo encarregado.", "erro");
      return;
    }

    if (!motivo && !numeroPublicacao) {
      showToast("Informe o motivo ou o nr da publicação.", "erro");
      return;
    }

    if (alterouPortaria === "Sim" && !novaPortaria) {
      showToast("Informe a nova portaria.", "erro");
      return;
    }

    const nomeResponsavel = nomeMilitarCurto?.(USUARIO_LOGADO) || "Assessor";
    const encarregadoAnterior = p.encarregado || p.substituicaoEncarregado?.novoEncarregado || p.substituicaoEncarregado?.encarregadoAnterior || "";
    const portariaAnterior = p.substituicaoEncarregado?.novaPortaria || p.substituicaoEncarregado?.portariaAnterior || p.numeroProcesso || "";

    const novaEntrada = {
      id: crypto.randomUUID(),
      houve: "Sim",
      data,
      motivo,
      novoEncarregado,
      postoNovoEncarregado,
      nomeNovoEncarregado,
      numeroPublicacao,
      alterouPortaria,
      novaPortaria: alterouPortaria === "Sim" ? novaPortaria : "",
      encarregadoAnterior,
      portariaAnterior,
      registradoPorNome: nomeResponsavel,
      criadoEm: new Date().toISOString(),
    };

    if (!Array.isArray(p.substituicoesEncarregado)) p.substituicoesEncarregado = [];
    salvarSnapshotUltimaAcao(p, "Substituição de encarregado");
    p.substituicoesEncarregado.push(novaEntrada);
    p.substituicaoEncarregado = { ...novaEntrada };
    p.encarregado = novoEncarregado;

    marcarCienciaAdmin(p, "Substituição de encarregado registrada pelo assessor.");
    salvarProcessos();
    adicionarMensagemSistema?.(
      p.id,
      `🔄 Encarregado substituído por ${nomeResponsavel}: ${encarregadoAnterior || "não informado"} → ${novoEncarregado}.${numeroPublicacao ? ` Publicação: ${numeroPublicacao}.` : ""}${motivo ? ` Motivo: ${motivo}.` : ""}${alterouPortaria === "Sim" && novaPortaria ? ` Portaria alterada para ${novaPortaria}.` : ""}`
    );
    refreshAll?.();
    fecharModalSubstituicaoEncarregado();
    showToast("Substituição registrada com sucesso.");
  }

  function salvarDataInicial() {
    const p = getProcessoAtual();
    if (!p) return;
    const v = $("inputDataInicialPrazo")?.value;
    if (!v) {
      showToast("Informe a data inicial.", "erro");
      return;
    }

    salvarSnapshotUltimaAcao(p, "Alteração da data inicial do prazo");
    salvarSnapshotUltimaAcao(p, "Alteração da data inicial do prazo");
    p.dataInicialPrazo = v;
    marcarCienciaAdmin(p, "Data inicial do prazo atualizada pelo assessor.");
    salvarProcessos();
    adicionarMensagemSistema?.(p.id, `Data inicial de prazo definida para ${new Date(v + "T00:00:00").toLocaleDateString("pt-BR")}.`);
    renderDetalhes();
    refreshAll?.();
    showToast("Data inicial de contagem salva com sucesso.");
  }

  function bindBotoesPrazo(container) {
    if (!container) return;
    // Usar event delegation para evitar múltiplos listeners
    container.addEventListener("click", (e) => {
      if (e.target.closest(".btn-prazo-pa")) {
        const btn = e.target.closest(".btn-prazo-pa");
        abrirModalPrazoPA(btn.dataset.id);
      }
    });
  }

  function abrirNovaProrrogacaoPA(processoId) {
    processoAtualId = processoId;
    const p = getProcessoAtual();
    if (!p) return;

    if (!p.portariaAssinadaEm) {
      showToast("Confirme a assinatura da portaria antes da prorrogação.", "erro");
      return;
    }

    if (!p.dataInicialPrazo) {
      showToast("Inicie o prazo antes de lançar uma prorrogação.", "erro");
      return;
    }

    if (isSindicancia(p) && p.dataInicialPrazoSolucao) {
      showToast("O prazo para solução já foi iniciado para esta sindicância.", "info");
      return;
    }

    abrirModalPrazoPA(processoId);
  }

  function iniciarPrazoSolucaoPA(processoId) {
    processoAtualId = processoId;
    const p = getProcessoAtual();
    if (!p) return;

    ensureCamposPrazo(p);

    if (!isSindicancia(p)) {
      showToast("O prazo para solução é aplicável apenas à sindicância.", "erro");
      return;
    }

    if (!p.portariaAssinadaEm || !p.dataInicialPrazo) {
      showToast("Inicie o prazo principal antes de abrir o prazo para solução.", "erro");
      return;
    }

    if (!prazoPrincipalVencido(p)) {
      showToast("O prazo principal ainda não foi encerrado.", "info");
      return;
    }

    if (p.dataInicialPrazoSolucao) {
      showToast("O prazo para solução já foi iniciado.", "info");
      return;
    }

    if (!confirm("Iniciar agora o prazo para solução de 10 dias?")) return;

    const hoje = new Date().toISOString().slice(0, 10);
    const nomeResponsavel = nomeMilitarCurto?.(USUARIO_LOGADO) || "Assessor";

    salvarSnapshotUltimaAcao(p, "Início do prazo para solução");
    salvarSnapshotUltimaAcao(p, "Início do prazo para solução");
    p.dataInicialPrazoSolucao = hoje;
    p.prazoSolucaoDias = 10;
    p.prazoSolucaoIniciadoPorNome = nomeResponsavel;
    p.status = "Para Solução";
    marcarCienciaAdmin(p, "Prazo para solução iniciado pelo assessor.");

    salvarProcessos();
    adicionarMensagemSistema?.(
      p.id,
      `📝 Prazo para solução iniciado em ${new Date(hoje + "T00:00:00").toLocaleDateString("pt-BR")} por ${nomeResponsavel}. Término previsto em ${calcPrazoSolucaoFinal(p)}.`
    );
    refreshAll?.();
    showToast("Prazo para solução iniciado com sucesso.");
  }

  on("btnFecharPrazoPA", "click", fecharModalPrazoPA);
  on("btnSalvarDataInicial", "click", salvarDataInicial);
  on("btnFecharSubstituicaoEncarregadoPA", "click", fecharModalSubstituicaoEncarregado);
  on("btnNovaSubstituicaoEncarregadoPA", "click", prepararNovaSubstituicaoEncarregado);
  on("btnSalvarSubstituicaoEncarregadoPA", "click", salvarSubstituicaoEncarregado);
  on("selectAlterouPortariaSubstituicaoPA", "change", function () {
    $("blocoNovaPortariaSubstituicaoPA")?.classList.toggle("hidden", this.value !== "Sim");
  });

  window.abrirSubstituicaoEncarregado = abrirModalSubstituicaoEncarregado;
  window.abrirNovaProrrogacaoPA = abrirNovaProrrogacaoPA;
  window.iniciarPrazoSolucaoPA = iniciarPrazoSolucaoPA;

  return {
    bindBotoesPrazo,
    bindBotoesPrazoPA: bindBotoesPrazo,
    abrirModalPrazoPA,
    abrirModalPrazo: abrirModalPrazoPA,
    abrirSubstituicaoEncarregado: abrirModalSubstituicaoEncarregado,
    abrirNovaProrrogacaoPA,
    iniciarPrazoSolucaoPA,
    fecharModalPrazoPA,
    fecharModalSubstituicaoEncarregado,
  };
}