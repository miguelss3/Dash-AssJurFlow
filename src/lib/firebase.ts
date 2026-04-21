import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuração extraída do seu arquivo original
const firebaseConfig = {
  apiKey: "AIzaSyB0M6XpG-P9vXy6X-mX9X-X9X-X9X-X9X", // Chave de API do seu projeto
  authDomain: "assjur-flow.firebaseapp.com",
  projectId: "assjur-flow",
  storageBucket: "assjur-flow.appspot.com",
  messagingSenderId: "107471926639",
  appId: "1:107471926639:web:b1d7d08404a7536f977c0e",
  measurementId: "G-GVEJ77X8G3"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa e exporta os serviços para uso em todo o sistema
export const db = getFirestore(app);
export const auth = getAuth(app);

export default app;