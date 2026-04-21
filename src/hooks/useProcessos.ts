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

    // Estados internos para armazenar processos e distribuições separadamente
    let processosCache: any[] = [];
    let distribuicoesCache: any[] = [];

    // Função para mesclar processos com distribuições
    const mesclarProcessosComDistribuicoes = () => {
      const listaProcessos: Processo[] = [];
      
      processosCache.forEach((procData) => {
        // Busca a distribuição correspondente ao processo
        const distribuicao = distribuicoesCache.find((d: any) => d.processoId === procData.id);
        
        // Mapeia status do sistema antigo para o novo
        const statusMap: Record<string, StatusProcesso> = {
          "Aguardando Distribuição": "novo",
          "Distribuído": "andamento",
          "Em Diligências": "andamento",
          "Portaria Assinada": "andamento",
          "Solução Concluída": "andamento",
          "Aguardando Assinatura Cmt": "andamento",
          "Pronto para Despacho Cmt": "andamento",
          "Finalizado": "concluido"
        };

        const statusOriginal = procData.status || "andamento";
        const statusMapeado: StatusProcesso = statusMap[statusOriginal] || "andamento";

        // Pega a última mensagem do histórico como descrição
        const historico = Array.isArray(procData.historico) ? procData.historico : [];
        const ultimaMensagem = historico.length > 0 ? historico[historico.length - 1] : null;
        const descricaoUltimoMovimento = ultimaMensagem?.texto || procData.ultimaAcaoDescricao || procData.descricao || "Sem movimentação";

        const processoMapeado: Processo = {
          id: procData.id,
          // Mapeamento de campos Firebase → Interface Processo
          numero: procData.numeroProcesso || procData.numero || "S/N",
          cliente: procData.parte || procData.cliente || "Não informado",
          vara: procData.vara || "N/A",
          parteContraria: procData.parteContraria || "N/A",
          tipoAcao: procData.assunto || procData.tipoAcao || "Sem assunto",
          // IMPORTANTE: usa assessorNome da distribuição se existir, senão usa encarregado do processo
          responsavel: distribuicao?.assessorNome || procData.encarregado || procData.responsavel || "Sem responsável",
          prazo: procData.prazoInternoDU || procData.prazo,
          prazoFatal: procData.prazoFatalDU || procData.prazoFatal,
          descricao: descricaoUltimoMovimento,
          status: statusMapeado,
          criadoEm: procData.criadoEm || procData.dataEntrada || new Date().toISOString(),
          // Campos específicos AssJur Flow
          tipo: (procData.setor || procData.tipo || "OUTRO") as any,
          setor: procData.setor,
          prioridade: (procData.prioridade || "normal") as any,
          secao: procData.secaoDU || procData.secao || "N/A",
          origem: procData.origemDU || procData.origem || "N/A",
          subtipo: procData.tipoPA || procData.subtipo,
          faseAtual: procData.status || procData.faseAtual,
          inicioPrazo: procData.dataInicialPrazo || procData.inicioPrazo,
          finalPrazo: procData.prazoFatalDU || procData.finalPrazo,
          entrada: procData.dataEntrada || procData.entrada,
          userId: procData.userId || procData.criadoPorId,
          userEmail: procData.userEmail
        };
        
        listaProcessos.push(processoMapeado);
      });
      
      // Debug
      if (listaProcessos.length > 0) {
        console.log("🔄 Mapeamento com distribuições:");
        console.log(`  Total processos: ${listaProcessos.length}`);
        console.log(`  Total distribuições: ${distribuicoesCache.length}`);
        console.log("  Exemplo - responsável:", listaProcessos[0].responsavel);
        console.log("  Exemplo - último movimento:", listaProcessos[0].descricao);
        
        const finalizados = listaProcessos.filter(p => p.status === "concluido").length;
        const ativos = listaProcessos.length - finalizados;
        console.log(`📊 Total: ${listaProcessos.length} | Ativos: ${ativos} | Finalizados: ${finalizados}`);
      }
      
      setProcessos(listaProcessos);
      setCarregando(false);
      setErro(null);
    };

    // Aponta para as coleções do Firestore
    const processosRef = collection(db, "processos");
    const distribuicoesRef = collection(db, "distribuicoes");
    
    // Query condicional para processos: 
    // - Admin: carrega TODOS os processos (sem filtro)
    // - Usuário regular: carrega apenas os processos dele (com filtro)
    const qProcessos = ehAdmin 
      ? query(processosRef)  // SEM filtro - carrega tudo
      : query(processosRef, where("userId", "==", currentUser.uid));  // COM filtro - apenas do usuário

    // Listener 1: Processos
    const unsubProcessos = onSnapshot(
      qProcessos,
      (snapshot) => {
        processosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ ${processosCache.length} processos carregados do Firebase`);
        mesclarProcessosComDistribuicoes();
      },
      (err) => {
        console.error("❌ Erro ao buscar processos:", err);
        setErro("Erro ao carregar processos");
        setCarregando(false);
      }
    );

    // Listener 2: Distribuições (sempre carrega todas para admin fazer o merge)
    const unsubDistribuicoes = onSnapshot(
      distribuicoesRef,
      (snapshot) => {
        distribuicoesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ ${distribuicoesCache.length} distribuições carregadas do Firebase`);
        mesclarProcessosComDistribuicoes();
      },
      (err) => {
        console.error("❌ Erro ao buscar distribuições:", err);
        // Continua mesmo se falhar, apenas sem as distribuições
        mesclarProcessosComDistribuicoes();
      }
    );

    // Cleanup: desinscreve dos listeners ao desmontar
    return () => {
      unsubProcessos();
      unsubDistribuicoes();
    };
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