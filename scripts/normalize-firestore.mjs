import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from "firebase/firestore";

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
const applyChanges = process.env.FIREBASE_MIGRATE_APPLY === "true";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function normalizeText(v) {
  return (v || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toCanonicalStatus(raw) {
  const n = normalizeText(raw);
  if (n === "novo") return "novo";
  if (n === "andamento") return "andamento";
  if (n === "audiencia") return "audiencia";
  if (n === "recurso") return "recurso";
  if (n === "concluido" || n === "finalizado") return "concluido";

  // Legacy values
  if (n === "aguardando distribuicao") return "novo";
  if (
    n === "distribuido" ||
    n === "em diligencias" ||
    n === "portaria assinada" ||
    n === "solucao concluida" ||
    n === "aguardando assinatura cmt" ||
    n === "pronto para despacho cmt" ||
    n === "para assinatura"
  ) {
    return "andamento";
  }

  return null;
}

async function run() {
  if (!password) {
    throw new Error("FIREBASE_AUDIT_PASSWORD não informado.");
  }

  console.log(`Modo: ${applyChanges ? "APPLY" : "DRY-RUN"}`);
  console.log(`Login: ${email}`);
  await signInWithEmailAndPassword(auth, email, password);

  const [processosSnap, mensagensSnap] = await Promise.all([
    getDocs(collection(db, "processos")),
    getDocs(collection(db, "mensagens")),
  ]);

  const processos = processosSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const mensagens = mensagensSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));

  const processoIds = new Set(processos.map((p) => p.id));
  const mensagemIds = new Set(mensagens.map((m) => m.id));

  const plan = {
    statusUpdates: [],
    finalizadoUpdates: [],
    createMensagemDocs: [],
    deleteMensagemOrfa: [],
    unknownStatus: [],
  };

  for (const p of processos) {
    const currentStatus = p.status;
    const canonical = toCanonicalStatus(currentStatus);

    if (!canonical) {
      if (currentStatus !== undefined) {
        plan.unknownStatus.push({ id: p.id, numero: p.numeroProcesso || p.numero, status: currentStatus });
      }
    } else if (currentStatus !== canonical) {
      plan.statusUpdates.push({ id: p.id, from: currentStatus, to: canonical });
    }

    const finalizadoAtual = p.finalizado === true;
    const finalizadoEsperado = canonical === "concluido";
    if (finalizadoAtual !== finalizadoEsperado) {
      plan.finalizadoUpdates.push({ id: p.id, from: p.finalizado, to: finalizadoEsperado });
    }

    if (!mensagemIds.has(p.id)) {
      plan.createMensagemDocs.push({ id: p.id });
    }
  }

  for (const m of mensagens) {
    if (!processoIds.has(m.id)) {
      plan.deleteMensagemOrfa.push({ id: m.id });
    }
  }

  const summary = {
    totalProcessos: processos.length,
    totalMensagens: mensagens.length,
    statusUpdates: plan.statusUpdates.length,
    finalizadoUpdates: plan.finalizadoUpdates.length,
    createMensagemDocs: plan.createMensagemDocs.length,
    deleteMensagemOrfa: plan.deleteMensagemOrfa.length,
    unknownStatus: plan.unknownStatus.length,
  };

  console.log("\n=== PLANO DE MIGRACAO ===");
  console.log(JSON.stringify(summary, null, 2));

  if (plan.unknownStatus.length) {
    console.log("\n[unknownStatus]");
    console.log(JSON.stringify(plan.unknownStatus, null, 2));
  }

  if (!applyChanges) {
    console.log("\nDry-run concluído. Nenhuma alteração foi escrita.");
    return;
  }

  let batch = writeBatch(db);
  let opCount = 0;
  let commitCount = 0;

  const commitIfNeeded = async (force = false) => {
    if (opCount === 0) return;
    if (opCount >= 450 || force) {
      await batch.commit();
      batch = writeBatch(db);
      opCount = 0;
      commitCount += 1;
    }
  };

  const statusById = new Map(plan.statusUpdates.map((s) => [s.id, s.to]));
  const finalizadoById = new Map(plan.finalizadoUpdates.map((f) => [f.id, f.to]));

  for (const p of processos) {
    const payload = {};
    if (statusById.has(p.id)) {
      payload.status = statusById.get(p.id);
    }
    if (finalizadoById.has(p.id)) {
      payload.finalizado = finalizadoById.get(p.id);
    }
    if (Object.keys(payload).length) {
      payload.migradoEm = serverTimestamp();
      batch.update(p.ref, payload);
      opCount += 1;
      await commitIfNeeded();
    }
  }

  for (const m of plan.createMensagemDocs) {
    const ref = doc(db, "mensagens", m.id);
    batch.set(ref, { historico: [] }, { merge: true });
    opCount += 1;
    await commitIfNeeded();
  }

  for (const m of plan.deleteMensagemOrfa) {
    batch.delete(doc(db, "mensagens", m.id));
    opCount += 1;
    await commitIfNeeded();
  }

  await commitIfNeeded(true);

  console.log("\nMigração aplicada com sucesso.");
  console.log(`Commits executados: ${commitCount}`);
}

run().catch((err) => {
  console.error("\nFalha na migração:");
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
