import { useEffect, useState, useCallback } from "react";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type User as FirebaseUser 
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

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

function mapAuthUserFromFirestore(data: Record<string, any>, fbUser: FirebaseUser): AuthUser {
  const nomeExtraido = fbUser.email ? fbUser.email.split("@")[0] : "Usuário";
  return {
    posto: data.posto || "",
    nome: data.nome || fbUser.displayName || nomeExtraido,
    role: data.role || "ASSESSOR",
    secao: data.secao || data.setor || "AssJur",
    email: fbUser.email || undefined,
    uid: fbUser.uid,
    nomeGuerra: data.nomeGuerra,
    setor: data.setor,
    cargo: data.cargo,
    isChefe: data.isChefe === true || data.isChefe === "sim",
    telefone: data.telefone,
  };
}

async function carregarPerfilPrivado(fbUser: FirebaseUser): Promise<AuthUser | null> {
  try {
    const docDireto = await getDoc(doc(db, "usuarios", fbUser.uid));
    if (docDireto.exists()) {
      return mapAuthUserFromFirestore(docDireto.data() as Record<string, any>, fbUser);
    }

    const usuariosRef = collection(db, "usuarios");
    const qUid = query(usuariosRef, where("uid", "==", fbUser.uid));
    const snapshotUid = await getDocs(qUid);
    if (!snapshotUid.empty) {
      return mapAuthUserFromFirestore(snapshotUid.docs[0].data() as Record<string, any>, fbUser);
    }

    if (fbUser.email) {
      const qEmail = query(usuariosRef, where("email", "==", fbUser.email));
      const snapshotEmail = await getDocs(qEmail);
      if (!snapshotEmail.empty) {
        return mapAuthUserFromFirestore(snapshotEmail.docs[0].data() as Record<string, any>, fbUser);
      }
    }
  } catch (error) {
    console.warn("⚠️ Falha ao buscar perfil privado do usuário:", error);
  }

  return null;
}

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
  const [user, setUser] = useState<AuthUser | null>(() => readStored());
  const [ready, setReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    // Monitora mudanças no estado de autenticação do Firebase
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        // Sempre busca o perfil atualizado do Firestore para não usar cache desatualizado.
        // O estado inicial já foi populado pelo readStored() no useState, então a UI
        // não trava enquanto a consulta ao Firestore acontece em segundo plano.
        let userData: AuthUser | null = await carregarPerfilPrivado(fbUser);

        if (userData) {
          // Perfil encontrado no Firestore — dados sempre frescos
          if (isAdmin(userData)) {
            userData.role = userData.cargo || userData.setor || "CHEFE ASSEAPASSJUR";
          }
        } else {
          // Firestore não retornou dados: usa cache local como fallback (ex: modo offline)
          const storedUser = readStored();
          if (storedUser) {
            userData = { ...storedUser, email: fbUser.email || undefined, uid: fbUser.uid };
            if (isAdmin(userData)) {
              userData.role = userData.cargo || userData.setor || "CHEFE ASSEAPASSJUR";
            }
            console.warn("⚠️ Firestore indisponível, usando perfil em cache.");
          } else {
            // Último recurso: dados mínimos do Firebase Auth
            const nomeExtraido = fbUser.email ? fbUser.email.split("@")[0] : "Usuário";
            userData = {
              posto: "",
              nome: fbUser.displayName || nomeExtraido,
              role: "ASSESSOR",
              secao: "AssJur",
              email: fbUser.email || undefined,
              uid: fbUser.uid,
            };
            console.warn("⚠️ Usuário sem perfil no Firestore/cache, usando dados mínimos:", userData);
          }
        }

        // Se é admin universal por email, garante role correto
        if (isAdmin(userData) && !userData.role) {
          userData.role = "ADMIN UNIVERSAL";
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
        setUser(userData);
      } else {
        setUser(null);
      }
      
      setReady(true);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    // Autentica no Firebase — qualquer falha (senha errada, usuário inexistente, etc.)
    // é propagada para a tela de login exibir a mensagem correta ao usuário.
    const userCredential = await signInWithEmailAndPassword(auth, email, senha);
    const fbUser = userCredential.user;

    // Busca dados do perfil no Firestore
    let userData: AuthUser | null = await carregarPerfilPrivado(fbUser);

    // Autenticado mas sem perfil no Firestore: usa dados mínimos do Firebase Auth
    if (!userData) {
      console.warn("⚠️ Usuário autenticado mas sem perfil na coleção usuarios. Usando dados mínimos.");
      const nomeUsuario = fbUser.displayName || (fbUser.email ? fbUser.email.split("@")[0] : "Usuário");
      userData = {
        posto: "",
        nome: nomeUsuario,
        role: "ASSESSOR",
        secao: "AssJur",
        email: fbUser.email || email,
        uid: fbUser.uid,
      };
    }

    if (isAdmin(userData)) {
      userData.role = userData.cargo || userData.setor || "ADMIN UNIVERSAL";
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      window.localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      // console.log("✅ Logout realizado");
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
