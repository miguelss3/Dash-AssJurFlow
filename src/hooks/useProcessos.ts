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
  getDocs,
  serverTimestamp 
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { Processo, StatusProcesso } from "@/types/processo";
import { isAdmin, type AuthUser } from "./useAuth";

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const limparCamposUndefined = <T extends Record<string, any>>(obj: T): Partial<T> => {
    return Object.fromEntries(
      Object.entries(obj).filter(([, valor]) => valor !== undefined)
    ) as Partial<T>;
  };

  const toIsoString = (valor: any): string | undefined => {
    if (!valor) return undefined;
    if (typeof valor === "string") return valor;
    if (valor instanceof Date) return valor.toISOString();
    if (typeof valor?.toDate === "function") return valor.toDate().toISOString();
    if (typeof valor?.seconds === "number") return new Date(valor.seconds * 1000).toISOString();
    return undefined;
  };

  const normalizarSetor = (valor: any): "DU" | "PA" | "" => {
    const txt = String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

    if (!txt) return "";
    if (txt === "DU" || txt.includes("DEFESA") || txt.includes("USUARIO")) return "DU";
    if (txt === "PA" || txt.includes("PROCESSO") || txt.includes("ADMIN")) return "PA";
    return "";
  };

  useEffect(() => {
    let unsubProcessos: (() => void) | null = null;
    let unsubDistribuicoes: (() => void) | null = null;

    // Aguarda o Firebase Auth resolver o estado de autenticação antes de inscrever os listeners
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Cancela listeners anteriores se existirem
      if (unsubProcessos) { unsubProcessos(); unsubProcessos = null; }
      if (unsubDistribuicoes) { unsubDistribuicoes(); unsubDistribuicoes = null; }

      if (!firebaseUser) {
        setProcessos([]);
        setErro(null);
        setCarregando(false);
        return;
      }

      setProcessos([]);
      setErro(null);
      setCarregando(true);

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
    
    // if (ehAdmin) {
    //   console.log("👑 ADMIN detectado! Carregando TODOS os processos...");
    // } else {
    //   console.log("👤 Assessor detectado. Carregando todos os processos (filtro por setor no frontend)...");
    // }

    // Estados internos para armazenar processos e distribuições separadamente
    let processosCache: any[] = [];
    let distribuicoesCache: any[] = [];

    // Função para mesclar processos com distribuições
    const mesclarProcessosComDistribuicoes = () => {
      const listaProcessos: Processo[] = [];
      
      processosCache.forEach((procData) => {
        const setorCanonico = normalizarSetor(procData.setor || procData.tipo);
        // Busca a distribuição correspondente ao processo
        const distribuicao = distribuicoesCache.find((d: any) => d.processoId === procData.id);
        
        // Mapeia status do sistema antigo/novo para o formato canônico da aplicação.
        const statusOriginalRaw = (procData.status || "").toString();
        const statusOriginalNorm = statusOriginalRaw
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

        const statusMapLegacy: Record<string, StatusProcesso> = {
          "aguardando distribuicao": "novo",
          "distribuido": "andamento",
          "em diligencias": "andamento",
          "portaria assinada": "andamento",
          "solucao concluida": "andamento",
          "aguardando assinatura cmt": "andamento",
          "pronto para despacho cmt": "andamento",
          "finalizado": "concluido",
          "concluido": "concluido",
          "novo": "novo",
          "andamento": "andamento",
          "audiencia": "audiencia",
          "recurso": "recurso",
        };

        // Verifica se está finalizado (compatível com dados legados e novos)
        const estaFinalizado =
          procData.finalizado === true ||
          statusOriginalNorm === "finalizado" ||
          statusOriginalNorm === "concluido";
        
        // if (estaFinalizado) {
        //   console.log(`⚠️ PROCESSO FINALIZADO: ${procData.numeroProcesso} (finalizado=${procData.finalizado}, status="${procData.status}")`);
        // }
        
        const statusMapeado: StatusProcesso = estaFinalizado
          ? "concluido"
          : (statusMapLegacy[statusOriginalNorm] || "andamento");

        // Pega a última mensagem do histórico como descrição
        // Prioriza o array historico (sistema antigo), depois tenta outros campos
        const historico = Array.isArray(procData.historico) ? procData.historico : [];
        const ultimaMensagem = historico.length > 0 ? historico[historico.length - 1] : null;
        const descricaoUltimoMovimento = ultimaMensagem?.texto 
          || procData.ultimaAtualizacaoDescricao 
          || procData.ultimaAcaoDescricao 
          || procData.descricao 
          || "Sem movimentação";

        const processoMapeado: Processo = {
          id: procData.id,
          // Mapeamento de campos Firebase → Interface Processo
          numero: procData.numeroProcesso || procData.numero || "S/N",
          cliente: procData.parte || procData.cliente || "Não informado",
          vara: procData.vara || "N/A",
          parteContraria: procData.parteContraria || "N/A",
          tipoAcao: procData.assunto || procData.tipoAcao || "Sem assunto",
          // IMPORTANTE: usa assessorNome da distribuição se existir, senão usa encarregado do processo
          // Se nenhum dos dois existir, deixa vazio (não coloca "Sem responsável")
          responsavel: distribuicao?.assessorNome || procData.encarregado || procData.responsavel || "",
          prazo: procData.prazoInternoDU || procData.prazo,
          prazoFatal: procData.prazoFatalDU || procData.prazoFatal,
          descricao: descricaoUltimoMovimento,
          status: statusMapeado,
          criadoEm: toIsoString(procData.criadoEm) || toIsoString(procData.dataEntrada) || new Date().toISOString(),
          // Campos específicos AssJur Flow
          tipo: (setorCanonico || procData.tipo || "OUTRO") as any,
          setor: setorCanonico || procData.setor,
          prioridade: (procData.prioridade || "normal") as any,
          secao: procData.secaoDU || procData.secao || "N/A",
          origem: procData.origemDU || procData.origem || "N/A",
          subtipo: procData.tipoPA || procData.subtipo,
          faseAtual: procData.status || procData.faseAtual,
          inicioPrazo: procData.dataInicialPrazo || procData.inicioPrazo,
          finalPrazo: procData.prazoFatalDU || procData.finalPrazo,
          entrada: procData.dataEntrada || procData.entrada,
          userId: procData.userId || procData.criadoPorId,
          userEmail: procData.userEmail,
          // Campos DU e PA específicos
          origemDU: procData.origemDU,
          secaoDU: procData.secaoDU,
          isMS: procData.isMS || false,
          dataEntrada: toIsoString(procData.dataEntrada) || procData.dataEntrada,
          observacoes: procData.observacoes,
          tipoPA: procData.tipoPA,
          encarregado: procData.encarregado,
          atualizadoEm: toIsoString(procData.atualizadoEm),
          pedidoSubsidios: procData.pedidoSubsidios
            ? {
                ...procData.pedidoSubsidios,
                solicitadoEm: toIsoString(procData.pedidoSubsidios?.solicitadoEm) || procData.pedidoSubsidios?.solicitadoEm,
              }
            : undefined,
          respostaDU: procData.respostaDU
            ? {
                ...procData.respostaDU,
                registradoEm: toIsoString(procData.respostaDU?.registradoEm) || procData.respostaDU?.registradoEm,
              }
            : undefined,
        };
        
        // console.log(`📦 Processo ${processoMapeado.numero}: status="${processoMapeado.status}", responsavel="${processoMapeado.responsavel}", setor=${processoMapeado.setor}, finalizado_firebase=${procData.finalizado}`);
        listaProcessos.push(processoMapeado);
      });
      
      // Debug
      // if (listaProcessos.length > 0) {
      //   console.log("🔄 Mapeamento com distribuições:");
      //   console.log(`  Total processos: ${listaProcessos.length}`);
      //   console.log(`  Total distribuições: ${distribuicoesCache.length}`);
      //   console.log("  Exemplo - responsável:", listaProcessos[0].responsavel);
      //   console.log("  Exemplo - último movimento:", listaProcessos[0].descricao);
      //   console.log("  Exemplo - setor:", listaProcessos[0].setor);
      //   console.log("  Exemplo - tipo:", listaProcessos[0].tipo);
      //   
      //   // Lista setores de todos os processos
      //   const setoresUnicos = [...new Set(listaProcessos.map(p => p.setor || p.tipo))];
      //   console.log("  Setores encontrados:", setoresUnicos);
      //   
      //   const finalizados = listaProcessos.filter(p => p.status === "concluido");
      //   const ativos = listaProcessos.length - finalizados.length;
      //   console.log(`📊 Total: ${listaProcessos.length} | Ativos: ${ativos} | Finalizados: ${finalizados.length}`);
      //   
      //   // Debug detalhado de processos finalizados
      //   if (finalizados.length > 0) {
      //     console.log("✅ Processos finalizados carregados:");
      //     finalizados.forEach(p => {
      //       console.log(`  - ${p.numero}: status="${p.status}"`);
      //     });
      //   }
      // }
      
      setProcessos(listaProcessos);
      setCarregando(false);
      setErro(null);
    };

    // Aponta para as coleções do Firestore
    const processosRef = collection(db, "processos");
    const distribuicoesRef = collection(db, "distribuicoes");
    
    // Query para processos:
    // Carrega TODOS os processos para admin E assessores
    // O filtro de visibilidade (minha mesa vs setor) acontece no frontend em index.tsx
    const qProcessos = query(processosRef);

    // Listener 1: Processos
    unsubProcessos = onSnapshot(
      qProcessos,
      (snapshot) => {
        processosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // console.log(`✅ ${processosCache.length} processos carregados do Firebase`);
        mesclarProcessosComDistribuicoes();
      },
      (err) => {
        console.error("❌ Erro ao buscar processos:", err);
        setErro("Erro ao carregar processos");
        setCarregando(false);
      }
    );

    // Listener 2: Distribuições (sempre carrega todas para admin fazer o merge)
    unsubDistribuicoes = onSnapshot(
      distribuicoesRef,
      (snapshot) => {
        distribuicoesCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // console.log(`✅ ${distribuicoesCache.length} distribuições carregadas do Firebase`);
        mesclarProcessosComDistribuicoes();
      },
      (err) => {
        console.error("❌ Erro ao buscar distribuições:", err);
        // Continua mesmo se falhar, apenas sem as distribuições
        mesclarProcessosComDistribuicoes();
      }
    );
    }); // fecha onAuthStateChanged

    // Cleanup: desinscreve de todos os listeners ao desmontar
    return () => {
      unsubAuth();
      if (unsubProcessos) unsubProcessos();
      if (unsubDistribuicoes) unsubDistribuicoes();
    };
  }, []); // executa uma vez — onAuthStateChanged cuida do ciclo de vida do auth

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

      const novoProcessoLimpo = limparCamposUndefined(novoProcesso);
      const novoDocRef = await addDoc(processosRef, novoProcessoLimpo);
      return novoDocRef.id;
      // console.log("✅ Processo criado com sucesso para", currentUser.email);
    } catch (err: any) {
      console.error("❌ Erro ao criar processo:", err);
      throw err;
    }
  };

  // Função para atualizar processo existente
  const atualizar = async (id: string, dados: Partial<Processo>) => {
    try {
      const processoRef = doc(db, "processos", id);

      const dadosLimpos = limparCamposUndefined(dados);
      if (Object.keys(dadosLimpos).length === 0) return;

      await updateDoc(processoRef, dadosLimpos);
      // console.log("✅ Processo atualizado com sucesso");
    } catch (err: any) {
      console.error("❌ Erro ao atualizar processo:", err);
      throw err;
    }
  };

  // Função para remover processo e todos os dados relacionados
  const remover = async (id: string) => {
    try {
      // console.log(`🗑️ Iniciando exclusão do processo ${id}...`);
      
      // 1. Remove mensagens da subcoleção historico
      try {
        const historicoRef = collection(db, "processos", id, "historico");
        const historicoSnapshot = await getDocs(historicoRef);
        const deleteHistoricoPromises = historicoSnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
        await Promise.all(deleteHistoricoPromises);
        // console.log(`✅ ${historicoSnapshot.size} mensagens do histórico removidas`);
      } catch (err) {
        console.warn("⚠️ Erro ao remover histórico:", err);
      }
      
      // 2. Remove distribuições relacionadas ao processo
      try {
        const distribuicoesRef = collection(db, "distribuicoes");
        const qDistrib = query(distribuicoesRef, where("processoId", "==", id));
        const distribSnapshot = await getDocs(qDistrib);
        const deleteDistribPromises = distribSnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
        await Promise.all(deleteDistribPromises);
        // console.log(`✅ ${distribSnapshot.size} distribuições removidas`);
      } catch (err) {
        console.warn("⚠️ Erro ao remover distribuições:", err);
      }
      
      // 3. Remove mensagens antigas (compatibilidade com sistema antigo)
      try {
        const mensagemRef = doc(db, "mensagens", id);
        await deleteDoc(mensagemRef);
        // console.log(`✅ Mensagens antigas removidas`);
      } catch (err) {
        // Ignora se não existir
        console.warn("⚠️ Mensagens antigas não encontradas");
      }
      
      // 4. Remove o documento principal do processo
      const processoRef = doc(db, "processos", id);
      await deleteDoc(processoRef);
      // console.log("✅ Processo principal removido com sucesso");
      
      // console.log(`✅ Processo ${id} e todos os dados relacionados foram excluídos permanentemente`);
    } catch (err: any) {
      console.error("❌ Erro ao remover processo:", err);
      throw err;
    }
  };

  // Função para mover processo para outro status (Kanban)
  const moverStatus = async (id: string, novoStatus: StatusProcesso) => {
    try {
      await atualizar(id, { status: novoStatus });
      // console.log(`✅ Processo movido para: ${novoStatus}`);
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