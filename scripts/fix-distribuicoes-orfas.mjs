/**
 * fix-distribuicoes-orfas.mjs
 * Identifica e remove distribuicoes cujo processoId não existe em 'processos'.
 *
 * Uso:
 *   $env:FIREBASE_AUDIT_PASSWORD='SUA_SENHA'; node scripts/fix-distribuicoes-orfas.mjs --dry-run
 *   $env:FIREBASE_AUDIT_PASSWORD='SUA_SENHA'; node scripts/fix-distribuicoes-orfas.mjs
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, deleteDoc } from "firebase/firestore";

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

async function run() {
  if (!password) throw new Error("FIREBASE_AUDIT_PASSWORD não informado.");

  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Autenticado como ${email}${DRY_RUN ? " [DRY RUN]" : ""}\n`);

  const [processosSnap, distribuicoesSnap] = await Promise.all([
    getDocs(collection(db, "processos")),
    getDocs(collection(db, "distribuicoes")),
  ]);

  const processoIds = new Set(processosSnap.docs.map((d) => d.id));
  const orfas = distribuicoesSnap.docs.filter(
    (d) => !d.data().processoId || !processoIds.has(d.data().processoId)
  );

  console.log(`Total de processos: ${processosSnap.size}`);
  console.log(`Total de distribuições: ${distribuicoesSnap.size}`);
  console.log(`Distribuições órfãs encontradas: ${orfas.length}\n`);

  let removidas = 0;
  for (const d of orfas) {
    const dados = d.data();
    console.log(
      `  ${DRY_RUN ? "[DRY]" : "[DEL]"} id=${d.id} processoId=${dados.processoId ?? "null"} assessorNome=${dados.assessorNome ?? "null"}`
    );
    if (!DRY_RUN) {
      await deleteDoc(doc(db, "distribuicoes", d.id));
    }
    removidas++;
  }

  console.log(
    `\n${DRY_RUN ? "Seriam removidas" : "Removidas"}: ${removidas} distribuição(ões) órfã(s).`
  );
}

run().catch((err) => {
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
