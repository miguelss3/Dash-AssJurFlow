import { useEffect, useState, useCallback } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export interface AuthUser {
  posto: string;
  nome: string;
  role: string;
  secao: string;
  email?: string;
  uid?: string;
  nomeGuerra?: string;
  setor?: string;
  cargo?: string;
  isChefe?: boolean;
  telefone?: string;
}

const STORAGE_KEY = "assjur:auth";

// Emails de admin universal (exatamente como no sistema antigo)
const EMAILS_ADMIN_UNIVERSAL = new Set(["miguelss3@yahoo.com.br"]);

/**
 * Verifica se o usuário é administrador (pode ver TODOS os processos)
 * Segue a mesma lógica do sistema antigo AssJurFlow
 */
export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  
  const emailNormalizado = user.email?.trim().toLowerCase();
  
  // Verifica se é admin universal por email
  if (emailNormalizado && EMAILS_ADMIN_UNIVERSAL.has(emailNormalizado)) {
    return true;
  }
  
  // Verifica se é Chefe Geral (como no sistema antigo)
  const setorNorm = user.setor?.trim().toUpperCase();
  if (setorNorm === "CHEFE ASSEAPASSJUR" || user.cargo === "Admin Universal") {
    return true;
  }
  
  // Verifica se é chefe
  if (user.isChefe === true) {
    return true;
  }
  
  return false;
}

function readStored(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Auth integrado com Firebase Authentication
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    // Monitora mudanças no estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        // Se autenticado no Firebase, carrega dados do localStorage
        const storedUser = readStored();
        if (storedUser) {
          const userData = { ...storedUser, email: fbUser.email || undefined, uid: fbUser.uid };
          
          // Se é admin, ajusta o role para refletir isso na UI
          if (isAdmin(userData)) {
            userData.role = userData.cargo || userData.setor || "CHEFE ASSEAPASSJUR";
          }
          
          console.log("🔄 Dados carregados do localStorage:", userData.nome, "|", userData.role, "| Admin:", isAdmin(userData));
          setUser(userData);
        } else {
          // Fallback: cria um usuário básico
          const nomeExtraido = fbUser.email ? fbUser.email.split("@")[0] : "Usuário";
          const userData = {
            posto: "Maj",
            nome: fbUser.displayName || nomeExtraido,
            role: "ASSESSOR",
            secao: "AssJur",
            email: fbUser.email || undefined,
            uid: fbUser.uid,
          };
          
          // Se é admin por email, ajusta o role
          if (isAdmin(userData)) {
            userData.role = "ADMIN UNIVERSAL";
          }
          
          setUser(userData);
        }
      } else {
        setUser(null);
      }
      
      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    try {
      console.log("🔐 Tentando login com:", email);
      
      try {
        // Tenta autenticar no Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, senha);
        const fbUser = userCredential.user;
        
        console.log("✅ Firebase Auth bem-sucedido para:", fbUser.email);
        
        // Busca dados do usuário na coleção "usuarios" (igual ao sistema antigo)
        let userData: AuthUser | null = null;
        
        try {
          console.log("🔍 Buscando dados do usuário na coleção usuarios...");
          const usuariosRef = collection(db, "usuarios");
          
          // Busca por email
          const qEmail = query(usuariosRef, where("email", "==", fbUser.email));
          const snapshotEmail = await getDocs(qEmail);
          
          if (!snapshotEmail.empty) {
            const userDoc = snapshotEmail.docs[0];
            const userFirestoreData = userDoc.data();
            const nomeExtraido = email ? email.split("@")[0] : "Usuário";
            
            userData = {
              posto: userFirestoreData.posto || "Maj",
              nome: userFirestoreData.nome || fbUser.displayName || nomeExtraido,
              role: userFirestoreData.role || "ASSESSOR",
              secao: userFirestoreData.secao || userFirestoreData.setor || "AssJur",
              email: fbUser.email || email,
              uid: fbUser.uid,
              nomeGuerra: userFirestoreData.nomeGuerra,
              setor: userFirestoreData.setor,
              cargo: userFirestoreData.cargo,
              isChefe: userFirestoreData.isChefe === true || userFirestoreData.isChefe === "sim",
              telefone: userFirestoreData.telefone,
            };
            
            // Se é admin, ajusta o role para refletir isso na UI
            if (isAdmin(userData)) {
              userData.role = userData.cargo || userData.setor || "CHEFE ASSEAPASSJUR";
            }
            
            console.log("✅ Dados do usuário carregados:", userData.nome, "|", userData.role, "| Admin:", isAdmin(userData));
          } else {
            // Se não encontrou por email, tenta buscar por UID
            const qUid = query(usuariosRef, where("uid", "==", fbUser.uid));
            const snapshotUid = await getDocs(qUid);
            
            if (!snapshotUid.empty) {
              const userDoc = snapshotUid.docs[0];
              const userFirestoreData = userDoc.data();
              const nomeExtraido = email ? email.split("@")[0] : "Usuário";
              
              userData = {
                posto: userFirestoreData.posto || "Maj",
                nome: userFirestoreData.nome || fbUser.displayName || nomeExtraido,
                role: userFirestoreData.role || "ASSESSOR",
                secao: userFirestoreData.secao || userFirestoreData.setor || "AssJur",
                email: fbUser.email || email,
                uid: fbUser.uid,
                nomeGuerra: userFirestoreData.nomeGuerra,
                setor: userFirestoreData.setor,
                cargo: userFirestoreData.cargo,
                isChefe: userFirestoreData.isChefe === true || userFirestoreData.isChefe === "sim",
                telefone: userFirestoreData.telefone,
              };
              
              // Se é admin, ajusta o role para refletir isso na UI
              if (isAdmin(userData)) {
                userData.role = userData.cargo || userData.setor || "CHEFE ASSEAPASSJUR";
              }
              
              console.log("✅ Dados do usuário carregados (por UID):", userData.nome, "|", userData.role, "| Admin:", isAdmin(userData));
            }
          }
        } catch (firestoreError) {
          console.warn("⚠️ Erro ao buscar dados do usuário no Firestore:", firestoreError);
        }
        
        // Se não encontrou dados no Firestore, usa dados básicos
        if (!userData) {
          console.warn("⚠️ Usuário não encontrado na coleção usuarios. Usando dados padrão.");
          const nomeUsuario = fbUser.displayName || (email ? email.split("@")[0] : "Usuário");
          userData = {
            posto: "Maj",
            nome: nomeUsuario,
            role: "ASSESSOR",
            secao: "AssJur",
            email: fbUser.email || email,
            uid: fbUser.uid,
          };
          
          // Se é admin por email, ajusta o role
          if (isAdmin(userData)) {
            userData.role = "ADMIN UNIVERSAL";
          }
        }
        
        // Salva dados no localStorage
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        setUser(userData);
        
        console.log("✅ Login concluído. Admin:", isAdmin(userData));
        return;
      } catch (firebaseError: any) {
        // Se falhar (usuário não existe ou Firebase não configurado), usa modo local
        console.warn("⚠️ Firebase Auth falhou, usando autenticação local:", firebaseError.code);
        
        // Cria usuário local baseado no email
        const nomeLocal = email.split("@")[0] || "Usuário";
        const userData: AuthUser = {
          posto: "Maj",
          nome: nomeLocal,
          role: "ASSESSOR",
          secao: "AssJur",
          email: email,
        };
        
        // Salva dados no localStorage
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        setUser(userData);
        
        console.log("✅ Login local realizado com sucesso");
      }
    } catch (error: any) {
      console.error("❌ Erro no login:", error.message);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      window.localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      console.log("✅ Logout realizado");
    } catch (error: any) {
      console.error("❌ Erro no logout:", error);
      throw error;
    }
  }, []);

  return { 
    user, 
    ready, 
    login, 
    logout, 
    isAuthenticated: !!firebaseUser && !!user,
    firebaseUser 
  };
}
