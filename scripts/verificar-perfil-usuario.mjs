/**
 * verificar-perfil-usuario.mjs
 *
 * Verifica se os usuários da coleção /usuarios têm um documento canônico
 * (ID do documento == campo uid), que é exigido pelo CadastroDU e CadastroPA
 * para permitir o cadastro de novos processos.
 *
 * Uso:
 *   node scripts/verificar-perfil-usuario.mjs
 *
 * Variáveis de ambiente (ou edite diretamente):
 *   FIREBASE_AUDIT_EMAIL    — e-mail de um admin
 *   FIREBASE_AUDIT_PASSWORD — senha
 *
 * Filtragem por nome (opcional):
 *   BUSCA_NOME=tamires node scripts/verificar-perfil-usuario.mjs
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2Pk4plzDbRJSrQdaIAu7P4fOPpvefAG0",
  authDomain: "assjur-flow-12rm.firebaseapp.com",
  projectId: "assjur-flow-12rm",
  storageBucket: "assjur-flow-12rm.firebasestorage.app",
  messagingSenderId: "441416018941",
  appId: "1:441416018941:web:fc57211a142956f7854794",
};

const loginEmail    = process.env.FIREBASE_AUDIT_EMAIL    || "miguel@12rm.eb.mil.br";
const loginPassword = process.env.FIREBASE_AUDIT_PASSWORD || "";
const buscaNome     = (process.env.BUSCA_NOME || "").toLowerCase().trim();

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

function norm(v) {
  return (v || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function verificar() {
  if (!loginPassword) {
    console.error("❌ Informe a senha via FIREBASE_AUDIT_PASSWORD=suaSenha node scripts/verificar-perfil-usuario.mjs");
    process.exit(1);
  }

  console.log(`\n🔐 Autenticando como ${loginEmail}...`);
  await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
  console.log("✅ Autenticado.\n");

  const snapshot = await getDocs(collection(db, "usuarios"));
  const todos = snapshot.docs.map((d) => ({ docId: d.id, ...d.data() }));

  // Filtra por nome se BUSCA_NOME foi informado
  const lista = buscaNome
    ? todos.filter((u) =>
        norm(u.nome).includes(buscaNome) ||
        norm(u.nomeGuerra).includes(buscaNome) ||
        norm(u.email).includes(buscaNome)
      )
    : todos;

  if (lista.length === 0) {
    console.log(`⚠️  Nenhum usuário encontrado${buscaNome ? ` para "${buscaNome}"` : ""}.`);
    process.exit(0);
  }

  console.log(`📋 Verificando ${lista.length} usuário(s)${buscaNome ? ` com nome/email contendo "${buscaNome}"` : ""}...\n`);

  const OK       = [];
  const PROBLEMA = [];

  for (const u of lista) {
    const nomeExibicao = u.nomeGuerra || u.nome || u.email || "(sem nome)";
    const uidNoCampo   = (u.uid || "").trim();
    const docId        = u.docId;
    const ativo        = u.ativo !== false;

    // 1. O próprio documento tem uid registrado?
    if (!uidNoCampo) {
      PROBLEMA.push({
        nome: nomeExibicao,
        email: u.email,
        docId,
        ativo,
        status: "⛔  SEM campo uid no documento",
        canonico: false,
      });
      continue;
    }

    // 2. O ID do documento é igual ao uid registrado?
    const canonico = docId === uidNoCampo;

    // 3. Existe um documento canônico em /usuarios/{uid}?
    let docCanonicoExiste = canonico; // se já é canônico, existe por definição
    if (!canonico) {
      const snap = await getDoc(doc(db, "usuarios", uidNoCampo));
      docCanonicoExiste = snap.exists();
    }

    const entrada = {
      nome: nomeExibicao,
      email: u.email,
      docId,
      uid: uidNoCampo,
      ativo,
      canonico,
      docCanonicoExiste,
    };

    if (canonico && ativo) {
      entrada.status = "✅  OK — documento canônico ativo";
      OK.push(entrada);
    } else if (canonico && !ativo) {
      entrada.status = "⚠️   Documento canônico mas INATIVO";
      PROBLEMA.push(entrada);
    } else if (!canonico && docCanonicoExiste) {
      entrada.status = "✅  Doc antigo — já existe canônico em /usuarios/{uid}";
      OK.push(entrada);
    } else {
      entrada.status = "🚨  Doc antigo SEM canônico — cadastro de processo BLOQUEADO";
      PROBLEMA.push(entrada);
    }
  }

  // --- Relatório ---
  if (OK.length > 0) {
    console.log("─".repeat(60));
    console.log(`✅  USUÁRIOS OK (${OK.length})`);
    console.log("─".repeat(60));
    for (const u of OK) {
      console.log(`  ${u.status}`);
      console.log(`  Nome  : ${u.nome}`);
      console.log(`  E-mail: ${u.email}`);
      console.log(`  DocID : ${u.docId}`);
      if (u.uid && u.uid !== u.docId) console.log(`  UID   : ${u.uid}`);
      console.log();
    }
  }

  if (PROBLEMA.length > 0) {
    console.log("─".repeat(60));
    console.log(`🚨  USUÁRIOS COM PROBLEMA (${PROBLEMA.length})`);
    console.log("─".repeat(60));
    for (const u of PROBLEMA) {
      console.log(`  ${u.status}`);
      console.log(`  Nome  : ${u.nome}`);
      console.log(`  E-mail: ${u.email}`);
      console.log(`  DocID : ${u.docId}`);
      if (u.uid) console.log(`  UID   : ${u.uid}`);
      console.log(`  Ativo : ${u.ativo}`);
      console.log();
    }
    console.log("💡 Solução: abra Gestão de Equipe, edite o usuário e salve sem alterar nada.");
    console.log("   Isso cria /usuarios/{uid} e desbloqueia o cadastro de processos.\n");
  } else {
    console.log("🎉 Nenhum problema encontrado. Todos os perfis estão sincronizados.\n");
  }

  process.exit(0);
}

verificar().catch((err) => {
  console.error("❌ Erro fatal:", err.message || err);
  process.exit(1);
});
