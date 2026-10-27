// Log de erros do sistema — grava em Firestore (coleção "logsErro") pra dar
// visibilidade de erros que acontecem na sessão de QUALQUER usuário, sem
// precisar pedir pra alguém abrir o DevTools e descrever o que apareceu.
// Veja o painel "Logs de Erro" em Ajustes do Site (admin).
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

function sanitizarExtra(extra?: Record<string, unknown>): Record<string, unknown> | null {
  if (!extra) return null;
  try {
    // Round-trip por JSON descarta `undefined`/funções/referências
    // circulares de forma segura — mais simples que sanitizar na mão, e
    // evita que o PRÓPRIO log quebre por causa do mesmo tipo de valor que
    // ele existe pra flagrar.
    return JSON.parse(JSON.stringify(extra));
  } catch {
    return null;
  }
}

// Nunca deixa o registro do log derrubar a ação original que falhou — por
// isso cada etapa tem seu próprio catch silencioso (só console.warn).
export function registrarErro(contexto: string, error: unknown, extra?: Record<string, unknown>): void {
  try {
    const usuario = auth.currentUser;
    const mensagem = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error && typeof error.stack === "string" ? error.stack.slice(0, 2000) : null;

    void addDoc(collection(db, "logsErro"), {
      contexto,
      mensagem,
      stack,
      extra: sanitizarExtra(extra),
      userId: usuario?.uid || null,
      userEmail: usuario?.email || null,
      rota: typeof window !== "undefined" ? window.location.pathname + window.location.hash : null,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      criadoEm: Timestamp.now(),
    }).catch((logError) => {
      console.warn("[errorLog] Falha ao gravar log de erro:", logError);
    });
  } catch (logError) {
    console.warn("[errorLog] Falha ao preparar log de erro:", logError);
  }
}

// Captura erros que escapam de qualquer try/catch explícito (JS não tratado
// e Promises rejeitadas sem .catch) — chamado uma vez no bootstrap do app
// (src/main.tsx). Protegido contra dupla inicialização (StrictMode/HMR).
export function iniciarCapturaGlobalDeErros(): void {
  if (typeof window === "undefined") return;
  const janela = window as typeof window & { __assjurflowCapturaGlobalAtiva?: boolean };
  if (janela.__assjurflowCapturaGlobalAtiva) return;
  janela.__assjurflowCapturaGlobalAtiva = true;

  window.addEventListener("error", (event) => {
    registrarErro("erro-global-nao-tratado", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    registrarErro("promise-rejeitada-nao-tratada", event.reason);
  });
}
