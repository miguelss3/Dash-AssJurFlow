import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB2Pk4plzDbRJSrQdaIAu7P4fOPpvefAG0",
  authDomain: "assjur-flow-12rm.firebaseapp.com",
  projectId: "assjur-flow-12rm",
  storageBucket: "assjur-flow-12rm.firebasestorage.app",
  messagingSenderId: "441416018941",
  appId: "1:441416018941:web:6b2e7c46e9b9bfef6c9e4e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function criarPerfilAdmin(email, senha) {
  console.log(`\n🔐 Criando perfil admin para ${email}...\n`);
  
  try {
    // Login
    const resultado = await signInWithEmailAndPassword(auth, email, senha);
    const uid = resultado.user.uid;
    console.log(`✅ Autenticado com sucesso! UID: ${uid}`);

    // Verificar se já existe
    const docRef = doc(db, 'usuarios', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      console.log(`⚠️ Perfil já existe para este usuário:`);
      console.log(JSON.stringify(docSnap.data(), null, 2));
      
      // Atualizar para garantir isChefe
      if (!docSnap.data().isChefe) {
        await setDoc(docRef, { isChefe: true }, { merge: true });
        console.log(`✅ Adicionado isChefe: true`);
      }
    } else {
      // Criar novo perfil
      const perfil = {
        uid,
        email,
        nome: email.split('@')[0],
        setor: 'PA',
        role: 'Admin Universal',
        cargo: 'Admin Universal',
        isChefe: true,
        isAdmin: true,
        criadoEm: new Date().toISOString(),
      };
      
      await setDoc(docRef, perfil);
      console.log(`✅ Perfil criado com sucesso!\n`);
      console.log(JSON.stringify(perfil, null, 2));
    }

    console.log(`\n✅ Você agora pode criar processos!\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Erro:`, error.message);
    process.exit(1);
  }
}

// Obter email e senha dos argumentos
const email = process.argv[2];
const senha = process.argv[3];

if (!email || !senha) {
  console.log(`\n📝 Uso: node create-admin-profile.mjs <email> <senha>\n`);
  console.log(`Exemplo: node create-admin-profile.mjs miguelss3@yahoo.com.br sua-senha\n`);
  process.exit(1);
}

criarPerfilAdmin(email, senha);
