/**
 * fix-du-distribuicao-faltante.mjs
 *
 * Corrige apenas processos DU que não possuem documento em "distribuicoes".
 * Não altera status/situacaoFluxo nem responsável do processo.
 *
 * Uso:
 *   $env:FIREBASE_AUDIT_EMAIL='miguelss3@yahoo.com.br'
 *   $env:FIREBASE_AUDIT_PASSWORD='SUA_SENHA'
 *   node scripts/fix-du-distribuicao-faltante.mjs --dry-run
 *   node scripts/fix-du-distribuicao-faltante.mjs
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

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
const DRY_RUN = process.argv.includes("--dry-run");

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function dividirEmLotes(itens, tamanho) {
  const lotes = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

async function run() {
  if (!password) throw new Error("FIREBASE_AUDIT_PASSWORD não informado.");

  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Autenticado como ${email}${DRY_RUN ? " [DRY RUN]" : ""}`);

  const processosDUSnap = await getDocs(query(collection(db, "processos"), where("setor", "==", "DU")));
  const processosDU = processosDUSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const distribuicoesByProcessoId = new Map();
  const idsDU = processosDU.map((p) => p.id);
  for (const lote of dividirEmLotes(idsDU, 10)) {
    const distSnap = await getDocs(query(collection(db, "distribuicoes"), where("processoId", "in", lote)));
    distSnap.docs.forEach((d) => {
      const data = d.data();
      const processoId = String(data.processoId || "").trim();
      if (!processoId) return;
      if (!distribuicoesByProcessoId.has(processoId)) {
        distribuicoesByProcessoId.set(processoId, { id: d.id, ...data });
      }
    });
  }

  const faltantes = processosDU.filter((p) => !distribuicoesByProcessoId.has(p.id));

  console.log(`\nProcessos DU: ${processosDU.length}`);
  console.log(`Distribuições DU existentes: ${distribuicoesByProcessoId.size}`);
  console.log(`Processos DU sem distribuição: ${faltantes.length}\n`);

  let criadas = 0;
  const agoraISO = new Date().toISOString();

  for (const p of faltantes) {
    const responsavel = String(p.responsavel || "").trim();
    const numero = p.numeroProcesso || p.numero || p.id;
    const payload = {
      processoId: p.id,
      assessorId: "manual_fix",
      assessorNome: responsavel,
      prazo: String(p.prazo || p.prazoInternoDU || ""),
      prioridade: String(p.prioridade || "Normal"),
      dataDistribuicao: agoraISO,
      atualizadoEm: agoraISO,
      origemFix: "fix-du-distribuicao-faltante",
    };

    if (DRY_RUN) {
      console.log(`[DRY] Criaria distribuição para ${numero} (${p.id}) -> assessorNome="${responsavel}"`);
    } else {
      await addDoc(collection(db, "distribuicoes"), payload);
      console.log(`[OK] Distribuição criada para ${numero} (${p.id}) -> assessorNome="${responsavel}"`);
    }
    criadas += 1;
  }

  console.log(`\n${DRY_RUN ? "Seriam criadas" : "Criadas"}: ${criadas} distribuição(ões) DU faltantes.`);
}

run().catch((err) => {
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
