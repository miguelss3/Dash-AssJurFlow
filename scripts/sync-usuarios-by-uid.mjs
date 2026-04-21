import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, setDoc } from "firebase/firestore";

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

async function run() {
  if (!password) {
    throw new Error("FIREBASE_AUDIT_PASSWORD não informado.");
  }

  await signInWithEmailAndPassword(auth, email, password);
  const usuariosSnap = await getDocs(collection(db, "usuarios"));

  let synced = 0;
  let skipped = 0;

  for (const d of usuariosSnap.docs) {
    const data = d.data() || {};
    const uid = (data.uid || "").toString().trim();

    if (!uid) {
      skipped += 1;
      continue;
    }

    await setDoc(
      doc(db, "usuarios", uid),
      {
        ...data,
        uid,
        email: data.email || null,
        sourceDocId: d.id,
        sincronizadoEm: new Date().toISOString(),
      },
      { merge: true },
    );

    synced += 1;
  }

  console.log(JSON.stringify({ total: usuariosSnap.size, synced, skipped }, null, 2));
}

run().catch((err) => {
  console.error(err?.code || err?.message || err);
  process.exit(1);
});
