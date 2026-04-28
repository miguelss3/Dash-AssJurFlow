#!/usr/bin/env node
/**
 * Script de Limpeza - Remove Documentos Duplicados do Firestore
 * 
 * Mantém apenas os novos usuários que estão funcionando:
 * - bawYZ4KZebaK1KIAGjYPort4apE3 (Novo Becker)
 * - 1xJoGC3siaaN9S9EdugI5FMHw1o2 (Novo Marlon)
 * 
 * Deleta os antigos:
 * - K5YJgdA8zwZ4mQx2AUUWbJPBKHk2 (Becker antigo)
 * - VglK2uSQyeUVoZvl8mskAdNDmTC2 (Marlon antigo/duplicata)
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, deleteDoc, getDoc } from "firebase/firestore";

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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Cores para terminal
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

const usuariosParaDeletear = [
  {
    id: "K5YJgdA8zwZ4mQx2AUUWbJPBKHk2",
    nome: "Becker (antigo - inativo)",
    email: "melynda.adv@gmail.com",
    motivo: "Duplicado com bawYZ4KZebaK1KIAGjYPort4apE3"
  },
  {
    id: "VglK2uSQyeUVoZvl8mskAdNDmTC2",
    nome: "Marlon (antigo/duplicata)",
    email: "marlon.rodrigues@eb.mil.br",
    motivo: "Duplicado com 1xJoGC3siaaN9S9EdugI5FMHw1o2"
  }
];

const usuariosParaManter = [
  {
    id: "bawYZ4KZebaK1KIAGjYPort4apE3",
    nome: "Becker (novo - funcionando)",
    email: "melynda.adv@gmail.com"
  },
  {
    id: "1xJoGC3siaaN9S9EdugI5FMHw1o2",
    nome: "Marlon (novo - funcionando)",
    email: "marlon.rodrigues@eb.mil.br"
  }
];

async function limpar() {
  log("blue", "\n========================================");
  log("blue", "🧹 LIMPEZA DE DUPLICADOS - FIRESTORE");
  log("blue", "========================================\n");

  if (!password) {
    throw new Error("❌ FIREBASE_AUDIT_PASSWORD não informado.");
  }

  log("yellow", `Autenticando como: ${email}`);
  await signInWithEmailAndPassword(auth, email, password);
  log("green", "✅ Autenticado!\n");

  log("cyan", "📋 Usuários que SERÃO MANTIDOS:\n");
  for (const u of usuariosParaManter) {
    log("green", `✅ ${u.id}`);
    log("green", `   Nome: ${u.nome}`);
    log("green", `   Email: ${u.email}\n`);
  }

  log("cyan", "🗑️  Usuários que SERÃO DELETADOS:\n");
  for (const u of usuariosParaDeletear) {
    log("red", `❌ ${u.id}`);
    log("red", `   Nome: ${u.nome}`);
    log("red", `   Email: ${u.email}`);
    log("red", `   Motivo: ${u.motivo}\n`);
  }

  // Pedir confirmação
  log("yellow", "⚠️  AVISO: Esta operação é IRREVERSÍVEL!");
  log("yellow", "Digite 'SIM' (em maiúscula) para confirmar a limpeza:");
  log("yellow", "(ou qualquer outra coisa para cancelar)\n");

  // Para simplificar em script não-interativo, vamos checar env var
  const confirmacao = process.env.CONFIRM_CLEANUP === "SIM";
  
  if (!confirmacao) {
    log("yellow", "\n⏸️  Limpeza cancelada. Para confirmar, rode:");
    log("cyan", "CONFIRM_CLEANUP=SIM FIREBASE_AUDIT_PASSWORD=... node scripts/cleanup-duplicates.mjs\n");
    process.exit(0);
  }

  log("red", "🔴 INICIANDO LIMPEZA...\n");

  let deletados = 0;
  let erros = 0;

  for (const usuario of usuariosParaDeletear) {
    try {
      // Verificar se documento existe
      const docRef = doc(db, "usuarios", usuario.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        log("yellow", `⚠️  ${usuario.id} - Já não existe no Firestore`);
        continue;
      }

      // Deletar
      await deleteDoc(docRef);
      log("green", `✅ Deletado: ${usuario.id} (${usuario.nome})`);
      deletados++;
    } catch (error) {
      log("red", `❌ Erro ao deletar ${usuario.id}: ${error.message}`);
      erros++;
    }
  }

  log("blue", "\n========================================");
  log("green", `✅ Limpeza concluída!`);
  log("green", `   - Deletados: ${deletados}`);
  log("red", `   - Erros: ${erros}`);
  log("blue", "========================================\n");

  if (erros === 0) {
    log("green", "✨ Sistema limpo com sucesso!");
    log("cyan", "\nPróximos passos:");
    log("cyan", "1. Faça logout dos antigos usuários (se ainda estiverem logados)");
    log("cyan", "2. Teste o login com os novos usuários:");
    log("cyan", "   - Email: melynda.adv@gmail.com (Becker novo)");
    log("cyan", "   - Email: marlon.rodrigues@eb.mil.br (Marlon novo)\n");
  }
}

limpar().catch((err) => {
  log("red", "\n❌ Falha na limpeza:");
  log("red", err?.message || err);
  process.exit(1);
});
