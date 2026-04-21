import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2Pk4plzDbRJSrQdaIAu7P4fOPpvefAG0",
  authDomain: "assjur-flow-12rm.firebaseapp.com",
  projectId: "assjur-flow-12rm",
  storageBucket: "assjur-flow-12rm.firebasestorage.app",
  messagingSenderId: "441416018941",
  appId: "1:441416018941:web:fc57211a142956f7854794",
  measurementId: "G-YZCJ6KRDPQ",
};

const email = process.env.FIREBASE_AUDIT_EMAIL || "miguel@12rm.eb.mil.br";
const password = process.env.FIREBASE_AUDIT_PASSWORD || "12rm2024";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const statusCanonicos = new Set(["novo", "andamento", "audiencia", "recurso", "concluido"]);
const tipoCanonicos = new Set(["DU", "PA", "OUTRO"]);

function normalizarTexto(v) {
  return (v || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function canonicalizarStatus(raw) {
  const n = normalizarTexto(raw);
  if (n === "finalizado" || n === "concluido") return "concluido";
  if (n === "novo") return "novo";
  if (n === "andamento") return "andamento";
  if (n === "audiencia") return "audiencia";
  if (n === "recurso") return "recurso";
  return null;
}

async function auditar() {
  console.log(`Audit login email: ${email}`);
  await signInWithEmailAndPassword(auth, email, password);

  const [processosSnap, distribuicoesSnap, usuariosSnap, mensagensSnap] = await Promise.all([
    getDocs(collection(db, "processos")),
    getDocs(collection(db, "distribuicoes")),
    getDocs(collection(db, "usuarios")),
    getDocs(collection(db, "mensagens")),
  ]);

  const processos = processosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const distribuicoes = distribuicoesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const usuarios = usuariosSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const mensagens = mensagensSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const inconsistencias = {
    statusNaoCanonico: [],
    statusConcluidoVariantes: [],
    tipoInvalido: [],
    setorInvalido: [],
    finalizadoSemConcluido: [],
    concluidoSemFinalizado: [],
    processoSemMensagem: [],
    processoSemDistribuicao: [],
    distribuicaoOrfa: [],
    mensagemOrfa: [],
  };

  const idsProcessos = new Set(processos.map((p) => p.id));
  const idsMensagens = new Set(mensagens.map((m) => m.id));
  const idsDistribuidos = new Set(distribuicoes.map((d) => d.processoId).filter(Boolean));

  for (const p of processos) {
    const statusRaw = p.status;
    const statusCanon = canonicalizarStatus(statusRaw);
    const statusRawNorm = normalizarTexto(statusRaw);

    if (!statusCanon && statusRaw !== undefined) {
      inconsistencias.statusNaoCanonico.push({ id: p.id, numero: p.numeroProcesso || p.numero, status: statusRaw });
    }

    if (statusRawNorm === "concluido" && statusRaw !== "concluido") {
      inconsistencias.statusConcluidoVariantes.push({ id: p.id, numero: p.numeroProcesso || p.numero, status: statusRaw });
    }

    if (p.tipo && !tipoCanonicos.has(p.tipo)) {
      inconsistencias.tipoInvalido.push({ id: p.id, numero: p.numeroProcesso || p.numero, tipo: p.tipo });
    }

    if (p.setor && !["DU", "PA", "OUTRO", "Admin"].includes(p.setor)) {
      inconsistencias.setorInvalido.push({ id: p.id, numero: p.numeroProcesso || p.numero, setor: p.setor });
    }

    if (p.finalizado === true && statusCanon !== "concluido") {
      inconsistencias.finalizadoSemConcluido.push({ id: p.id, numero: p.numeroProcesso || p.numero, status: statusRaw });
    }

    if (statusCanon === "concluido" && p.finalizado !== true) {
      inconsistencias.concluidoSemFinalizado.push({ id: p.id, numero: p.numeroProcesso || p.numero, status: statusRaw });
    }

    if (!idsMensagens.has(p.id)) {
      inconsistencias.processoSemMensagem.push({ id: p.id, numero: p.numeroProcesso || p.numero });
    }

    if (!idsDistribuidos.has(p.id)) {
      inconsistencias.processoSemDistribuicao.push({ id: p.id, numero: p.numeroProcesso || p.numero });
    }
  }

  for (const d of distribuicoes) {
    if (!d.processoId || !idsProcessos.has(d.processoId)) {
      inconsistencias.distribuicaoOrfa.push({ id: d.id, processoId: d.processoId || null });
    }
  }

  for (const m of mensagens) {
    if (!idsProcessos.has(m.id)) {
      inconsistencias.mensagemOrfa.push({ id: m.id });
    }
  }

  const resumo = {
    total: {
      processos: processos.length,
      distribuicoes: distribuicoes.length,
      usuarios: usuarios.length,
      mensagens: mensagens.length,
    },
    inconsistencias: Object.fromEntries(
      Object.entries(inconsistencias).map(([k, v]) => [k, v.length]),
    ),
  };

  console.log("\n=== RESUMO ===");
  console.log(JSON.stringify(resumo, null, 2));

  console.log("\n=== DETALHES (ate 15 por categoria) ===");
  for (const [k, v] of Object.entries(inconsistencias)) {
    if (!v.length) continue;
    console.log(`\n[${k}] ${v.length}`);
    console.log(JSON.stringify(v.slice(0, 15), null, 2));
  }
}

auditar().catch((err) => {
  console.error("\nFalha na auditoria:");
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
