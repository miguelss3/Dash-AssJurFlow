#!/usr/bin/env node
/**
 * Quarentena segura de mensagens órfãs (coleção legada mensagens)
 *
 * - Não deleta documentos da coleção mensagens
 * - Copia órfãs reais para mensagens_orfas
 * - Só executa se conseguir ler processos (evita falso positivo)
 * - Pode rodar em modo pré-visualização (padrão)
 *
 * Uso (preview):
 *   $env:FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br"; $env:FIREBASE_AUDIT_PASSWORD="..."; node scripts/quarantine-orphan-messages.mjs
 *
 * Uso (executar cópia para quarentena):
 *   $env:FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br"; $env:FIREBASE_AUDIT_PASSWORD="..."; $env:CONFIRM_QUARANTINE="SIM"; node scripts/quarantine-orphan-messages.mjs
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyB2Pk4plzDbRJSrQdaIAu7P4fOPpvefAG0",
  authDomain: "assjur-flow-12rm.firebaseapp.com",
  projectId: "assjur-flow-12rm",
  storageBucket: "assjur-flow-12rm.firebasestorage.app",
  messagingSenderId: "441416018941",
  appId: "1:441416018941:web:fc57211a142956f7854794",
  measurementId: "G-YZCJ6KRDPQ",
};

const email = process.env.FIREBASE_AUDIT_EMAIL || "miguelss3@yahoo.com.br";
const password = process.env.FIREBASE_AUDIT_PASSWORD || "";
const confirmar = process.env.CONFIRM_QUARANTINE === "SIM";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, ...args) {
  console.log(`${colors[color] || ""}${args.join(" ")}${colors.reset}`);
}

async function carregarColecaoSegura(nomeColecao) {
  try {
    const snapshot = await getDocs(collection(db, nomeColecao));
    return {
      docs: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
      acessoNegado: false,
    };
  } catch (err) {
    if (err.code === "permission-denied") {
      return {
        docs: [],
        acessoNegado: true,
      };
    }
    throw err;
  }
}

async function executar() {
  log("blue", "\n========================================");
  log("blue", "🧰 QUARENTENA DE MENSAGENS ORFAS");
  log("blue", "========================================");

  if (!password) {
    throw new Error("FIREBASE_AUDIT_PASSWORD não informado.");
  }

  log("yellow", `\nAutenticando como: ${email}`);
  await signInWithEmailAndPassword(auth, email, password);
  log("green", "✅ Autenticado!");

  log("cyan", "\n📂 Carregando processos e mensagens...");
  const [processosResp, mensagensResp] = await Promise.all([
    carregarColecaoSegura("processos"),
    carregarColecaoSegura("mensagens"),
  ]);

  if (processosResp.acessoNegado) {
    log("red", "\n❌ Acesso negado à coleção processos.");
    log("yellow", "Abortando para evitar falso positivo de orfandade.");
    process.exit(1);
  }

  const processosValidos = new Set(processosResp.docs.map((p) => p.id));
  const mensagens = mensagensResp.docs;

  const mensagensOrfas = mensagens.filter((m) => !processosValidos.has(m.id));

  log("green", `✅ Processos lidos: ${processosResp.docs.length}`);
  log("green", `✅ Mensagens lidas: ${mensagens.length}`);
  log("yellow", `⚠️  Orfãs reais detectadas: ${mensagensOrfas.length}`);

  const previewPath = "quarantine-orphan-messages-preview.json";
  fs.writeFileSync(
    previewPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalProcessos: processosResp.docs.length,
        totalMensagens: mensagens.length,
        totalOrfas: mensagensOrfas.length,
        mensagem: confirmar
          ? "Execucao com copia para quarentena habilitada."
          : "Apenas preview. Nenhum documento foi alterado.",
        idsOrfas: mensagensOrfas.map((m) => m.id),
      },
      null,
      2,
    ),
  );
  log("green", `✅ Preview salvo: ${previewPath}`);

  if (!confirmar) {
    log("blue", "\nModo preview finalizado. Nenhuma alteracao aplicada.");
    log("yellow", "Para copiar para quarentena, rode com CONFIRM_QUARANTINE=SIM.");
    return;
  }

  log("cyan", "\n🚚 Copiando mensagens orfãs para mensagens_orfas...");
  let copiadas = 0;
  let erros = 0;

  for (const mensagem of mensagensOrfas) {
    try {
      await setDoc(doc(db, "mensagens_orfas", mensagem.id), {
        ...mensagem,
        origemColecao: "mensagens",
        motivoQuarentena: "processoNaoEncontrado",
        quarantinedAt: serverTimestamp(),
      }, { merge: true });
      copiadas += 1;
    } catch (err) {
      erros += 1;
      log("red", `❌ Falha ao copiar ${mensagem.id}:`, err?.code || err?.message || String(err));
    }
  }

  const resultPath = "quarantine-orphan-messages-result.json";
  fs.writeFileSync(
    resultPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalOrfasDetectadas: mensagensOrfas.length,
        totalCopiadas: copiadas,
        totalErros: erros,
        observacao: "Documentos originais em mensagens NAO foram deletados.",
      },
      null,
      2,
    ),
  );

  log("blue", "\n========================================");
  log(erros > 0 ? "yellow" : "green", `Copiadas para quarentena: ${copiadas}`);
  log(erros > 0 ? "yellow" : "green", `Erros: ${erros}`);
  log("green", `Resultado salvo: ${resultPath}`);
  log("blue", "========================================\n");
}

executar().catch((err) => {
  log("red", "\n❌ Falha na quarentena:");
  log("red", err?.code || err?.message || String(err));
  process.exit(1);
});
