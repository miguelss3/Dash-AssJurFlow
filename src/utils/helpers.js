export const $ = (id) => document.getElementById(id);

export const on = (id, evt, fn) => {
    const el = $(id);
    if (el) el.addEventListener(evt, fn);
};

export function showToast(msg, tipo = "ok") {
    const toast = $("toast"), toastMsg = $("toastMsg"), icon = $("toastIcon");
    if (!toast || !toastMsg || !icon) return;
    toastMsg.textContent = msg;
    icon.setAttribute("data-lucide", tipo === "ok" ? "check-circle" : "alert-circle");
    toast.classList.remove("hidden");
    toast.classList.add("flex");
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => { toast.classList.add("hidden"); toast.classList.remove("flex"); }, 2500);
}

export function formatarData(str) {
    if (!str) return "—";

    // Aceita formatos antigos/novos: "YYYY-MM-DD", ISO, Date e Timestamp do Firestore.
    if (typeof str === "string") {
        const valor = str.trim();
        if (!valor) return "—";

        if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
            const [y, m, d] = valor.split("-");
            return `${d}/${m}/${y}`;
        }

        const dataIso = new Date(valor);
        if (!Number.isNaN(dataIso.getTime())) {
            return dataIso.toLocaleDateString("pt-BR");
        }
        return "—";
    }

    if (str instanceof Date) {
        if (Number.isNaN(str.getTime())) return "—";
        return str.toLocaleDateString("pt-BR");
    }

    if (typeof str?.toDate === "function") {
        const dataTs = str.toDate();
        if (dataTs instanceof Date && !Number.isNaN(dataTs.getTime())) {
            return dataTs.toLocaleDateString("pt-BR");
        }
        return "—";
    }

    if (typeof str?.seconds === "number") {
        const dataSeg = new Date(str.seconds * 1000);
        if (!Number.isNaN(dataSeg.getTime())) {
            return dataSeg.toLocaleDateString("pt-BR");
        }
    }

    return "—";
}

export function badgeSetor(setor) {
    return setor === "DU" 
        ? `<span class="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded border border-blue-200">DU</span>` 
        : `<span class="bg-purple-100 text-purple-700 text-[10px] font-black px-2 py-0.5 rounded border border-purple-200">PA</span>`;
}

export function badgePrioridade(p) {
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-slate-100 text-slate-600">${p || "Normal"}</span>`;
}

export function formatarNumeroExibicao(p) {
    const numero = p?.numeroProcesso || p?.nup || "—";
    if (p?.setor === "PA" && (p?.tipoPA === "Sindicância" || p?.tipoPA === "IPM")) {
        if (!/^portaria/i.test(numero)) {
            return `Portaria Nr ${numero}`;
        }
    }
    return numero;
}

export function nomeMilitarCurto(usuario) {
    const posto = String(usuario?.posto || "").trim();
    const nomeGuerra = String(usuario?.nomeGuerra || "").trim();
    if (posto && nomeGuerra) return `${posto} ${nomeGuerra}`;
    return usuario?.nomeGuerra || usuario?.nome || "—";
}

export function ehChefe(usuario) {
    const valor = String(usuario?.isChefe ?? "").trim().toLowerCase();
    const cargo = String(usuario?.cargo ?? "").trim().toLowerCase();
    const setor = String(usuario?.setor ?? "").trim().toLowerCase();
    return valor === "sim" || valor === "true" || usuario?.isChefe === true || cargo.includes("chefe") || setor.startsWith("chefe");
}

function normalizarSetor(valor) {
    return String(valor || "").trim().toUpperCase();
}

export function ehChefeGeral(usuario) {
    return normalizarSetor(usuario?.setor) === "CHEFE ASSEAPASSJUR" || usuario?.cargo === "Admin Universal";
}

export function obterNomeAssessorExibicao(dist, usuarios = []) {
    if (!dist) return "—";
    const u = usuarios.find((x) => (x.id || x.uid) === dist.assessorId);
    const nomeFallback = String(dist.assessorNome || "").trim();
    return u ? nomeMilitarCurto(u) : (nomeFallback || "—");
}