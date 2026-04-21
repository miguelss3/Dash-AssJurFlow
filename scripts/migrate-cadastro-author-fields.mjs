import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDocs, getFirestore, writeBatch } from "firebase/firestore";

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

function nomeFromEmail(v) {
  if (!v || typeof v !== "string") return "Sistema";
  return v.split("@")[0] || "Sistema";
}

function cleanUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  );
}

function normalizarTextoCadastro(texto, autor) {
  if (!texto || typeof texto !== "string") return texto;
  const t = texto.trim();
  const typo = /^'?\s*process\s+cadastrado\s+no\s+sistema\.?\s*'?$/i;
  const canonical = /^processo\s+cadastrado\s+no\s+sistema\s+por\s+.+\.$/i;

  if (canonical.test(t)) return t;
  if (typo.test(t) || /^processo\s+cadastrado\s+no\s+sistema\.?$/i.test(t)) {
    return `Processo cadastrado no sistema por ${autor}.`;
  }

  return texto;
}

async function run() {
  if (!password) throw new Error("FIREBASE_AUDIT_PASSWORD não informado");

  await signInWithEmailAndPassword(auth, email, password);

  const [processosSnap, mensagensSnap] = await Promise.all([
    getDocs(collection(db, "processos")),
    getDocs(collection(db, "mensagens")),
  ]);

  let processosAtualizados = 0;
  let mensagensAtualizadas = 0;

  let batch = writeBatch(db);
  let ops = 0;

  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return;
    if (ops >= 400 || force) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  };

  for (const p of processosSnap.docs) {
    const data = p.data();
    const autorEmail = data.userEmail || null;
    const autorUid = data.userId || null;
    const autorNome = data.criadoPorNome || nomeFromEmail(autorEmail);

    const patch = cleanUndefined({
      criadoPorNome: autorNome,
      criadoPorUid: autorUid,
      criadoPorEmail: autorEmail,
      descricao: normalizarTextoCadastro(data.descricao, autorNome),
    });

    const mudou =
      patch.criadoPorNome !== data.criadoPorNome ||
      patch.criadoPorUid !== data.criadoPorUid ||
      patch.criadoPorEmail !== data.criadoPorEmail ||
      patch.descricao !== data.descricao;

    if (mudou) {
      batch.update(p.ref, patch);
      ops += 1;
      processosAtualizados += 1;
      await commitIfNeeded();
    }
  }

  for (const m of mensagensSnap.docs) {
    const data = m.data();
    const historico = Array.isArray(data.historico) ? data.historico : [];
    let changed = false;

    const novoHistorico = historico.map((h) => {
      const autor = h?.autor || "Sistema";
      const novoTexto = normalizarTextoCadastro(h?.texto, autor);
      if (novoTexto !== h?.texto) {
        changed = true;
        return { ...h, texto: novoTexto };
      }
      return h;
    });

    if (changed) {
      batch.set(doc(db, "mensagens", m.id), { historico: novoHistorico }, { merge: true });
      ops += 1;
      mensagensAtualizadas += 1;
      await commitIfNeeded();
    }
  }

  await commitIfNeeded(true);

  console.log(
    JSON.stringify(
      {
        processosTotal: processosSnap.size,
        mensagensTotal: mensagensSnap.size,
        processosAtualizados,
        mensagensAtualizadas,
      },
      null,
      2,
    ),
  );
}

run().catch((err) => {
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
