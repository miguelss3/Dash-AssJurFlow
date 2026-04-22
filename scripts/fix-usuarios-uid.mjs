/**
 * fix-usuarios-uid.mjs
 * Escreve uid = docId em todos os documentos de 'usuarios' que não têm uid definido.
 * O docId é o Firebase Auth UID (padrão do sistema).
 *
 * Uso:
 *   $env:FIREBASE_AUDIT_PASSWORD='SUA_SENHA'; node scripts/fix-usuarios-uid.mjs
 */
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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

  const snap = await getDocs(collection(db, "usuarios"));
  const semUid = snap.docs.filter((d) => {
    const uid = String(d.data().uid ?? "").trim();
    return !uid;
  });

  console.log(`Total de usuários: ${snap.size}`);
  console.log(`Sem uid definido: ${semUid.length}\n`);

  let corrigidos = 0;
  for (const d of semUid) {
    const novoUid = d.id; // docId IS the Auth UID
    const email_doc = d.data().email ?? null;
    console.log(`  ${DRY_RUN ? "[DRY]" : "[FIX]"} docId=${d.id} email=${email_doc} → uid=${novoUid}`);
    if (!DRY_RUN) {
      await updateDoc(doc(db, "usuarios", d.id), { uid: novoUid });
    }
    corrigidos++;
  }

  console.log(`\n${DRY_RUN ? "Seriam corrigidos" : "Corrigidos"}: ${corrigidos} documento(s).`);
}

run().catch((err) => {
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
