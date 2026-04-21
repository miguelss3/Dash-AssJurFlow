import { useState, useEffect } from "react";
import { 
  collection, 
  query, 
  where,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import type { Processo, StatusProcesso } from "@/types/processo";
import { isAdmin, type AuthUser } from "./useAuth";

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Verifica se há usuário autenticado
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.warn("⚠️ Usuário não autenticado. Aguardando login...");
      setCarregando(false);
      return;
    }

    // Busca dados do usuário do localStorage para verificar se é admin
    let userData: AuthUser | null = null;
    try {
      const stored = window.localStorage.getItem("assjur:auth");
      if (stored) {
        userData = JSON.parse(stored) as AuthUser;
      }
    } catch (e) {
      console.warn("⚠️ Erro ao ler dados do localStorage:", e);
    }

    const ehAdmin = isAdmin(userData);
    
    if (ehAdmin) {
      console.log("👑 ADMIN detectado! Carregando TODOS os processos do Firebase...");
    } else {
      console.log("🔍 Usuário regular. Carregando apenas processos de:", currentUser.email);
    }

    // Aponta para a coleção "processos" real da 12ª RM no Firestore
    const processosRef = collection(db, "processos");
    
    // Query condicional: 
    // - Admin: carrega TODOS os processos (sem filtro)
    // - Usuário regular: carrega apenas os processos dele (com filtro)
    const q = ehAdmin 
      ? query(processosRef)  // SEM filtro - carrega tudo
      : query(processosRef, where("userId", "==", currentUser.uid));  // COM filtro - apenas do usuário

    // O onSnapshot fica "ouvindo" o banco. Qualquer mudança reflete na tela na hora.
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const listaProcessos: Processo[] = [];
        snapshot.forEach((docSnap) => {
          listaProcessos.push({ id: docSnap.id, ...docSnap.data() } as Processo);
        });
        
        setProcessos(listaProcessos);
        
        if (ehAdmin) {
          console.log(`✅ ${listaProcessos.length} processos carregados (ADMIN - todos os processos)`);
        } else {
          console.log(`✅ ${listaProcessos.length} processos carregados para ${currentUser.email}`);
        }
        
        setCarregando(false);
        setErro(null);
      },
      (err) => {
        console.error("❌ Erro ao buscar processos do Firebase:", err);
        console.error("❌ Código do erro:", err.code);
        console.error("❌ Mensagem:", err.message);
        console.warn("⚠️ Configure as regras do Firestore. Ver FIREBASE_SETUP.md");
        console.warn("⚠️ Usando dados mockados temporariamente...");
        
        // Dados mockados para desenvolvimento enquanto Firebase não está configurado
        const nomeUsuario = currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "Usuário");
        const processosMock: Processo[] = [
          {
            id: "mock-1",
            numero: "1234567-89.2026.4.01.3600",
            cliente: "Sgt Silva",
            vara: "1ª Vara Federal",
            parteContraria: "União",
            tipoAcao: "Mandado de Segurança",
            responsavel: nomeUsuario,
            prazo: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
            descricao: "Aguardando decisão liminar",
            status: "andamento" as StatusProcesso,
            criadoEm: new Date().toISOString(),
            tipo: "DU" as const,
            prioridade: "urgente" as const,
            secao: "AssJur",
            origem: "E-mail",
            userId: currentUser?.uid,
            userEmail: currentUser?.email || undefined
          },
          {
            id: "mock-2",
            numero: "IPM 001/2026",
            cliente: "Cb Santos",
            vara: "N/A",
            parteContraria: "N/A",
            tipoAcao: "Inquérito Policial Militar",
            responsavel: nomeUsuario,
            prazo: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
            descricao: "Em fase de diligências",
            status: "andamento" as StatusProcesso,
            criadoEm: new Date().toISOString(),
            tipo: "PA" as const,
            prioridade: "normal" as const,
            secao: "SFPC",
            origem: "Ofício",
            subtipo: "IPM",
            faseAtual: "Em diligência",
            userId: currentUser?.uid,
            userEmail: currentUser?.email || undefined
          }
        ];
        
        setProcessos(processosMock);
        setErro(`Firebase: ${err.code || "erro desconhecido"}. Usando dados mock.`);
        setCarregando(false);
      }
    );

    // Desliga o ouvinte quando o usuário sai da tela
    return () => unsubscribe();
  }, [auth.currentUser?.uid]); // Recarrega quando o usuário muda

  // Função para criar novo processo
  const criar = async (dados: Omit<Processo, "id" | "criadoEm" | "userId" | "userEmail">) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Usuário não autenticado");
      }

      const processosRef = collection(db, "processos");
      const novoProcesso = {
        ...dados,
        criadoEm: new Date().toISOString(),
        userId: currentUser.uid,
        userEmail: currentUser.email || "",
      };
      
      await addDoc(processosRef, novoProcesso);
      console.log("✅ Processo criado com sucesso para", currentUser.email);
    } catch (err: any) {
      console.error("❌ Erro ao criar processo:", err);
      throw err;
    }
  };

  // Função para atualizar processo existente
  const atualizar = async (id: string, dados: Partial<Processo>) => {
    try {
      const processoRef = doc(db, "processos", id);
      await updateDoc(processoRef, dados);
      console.log("✅ Processo atualizado com sucesso");
    } catch (err: any) {
      console.error("❌ Erro ao atualizar processo:", err);
      throw err;
    }
  };

  // Função para remover processo
  const remover = async (id: string) => {
    try {
      const processoRef = doc(db, "processos", id);
      await deleteDoc(processoRef);
      console.log("✅ Processo removido com sucesso");
    } catch (err: any) {
      console.error("❌ Erro ao remover processo:", err);
      throw err;
    }
  };

  // Função para mover processo para outro status (Kanban)
  const moverStatus = async (id: string, novoStatus: StatusProcesso) => {
    try {
      await atualizar(id, { status: novoStatus });
      console.log(`✅ Processo movido para: ${novoStatus}`);
    } catch (err: any) {
      console.error("❌ Erro ao mover processo:", err);
      throw err;
    }
  };

  return { 
    processos, 
    carregando, 
    erro,
    criar,
    atualizar,
    remover,
    moverStatus
  };
}