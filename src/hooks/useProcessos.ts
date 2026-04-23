import { useState, useEffect, useRef } from "react";
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
  type Query,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import type { Processo, StatusProcesso } from "@/types/processo";
import { isAdmin, type AuthUser } from "./useAuth";
import { calcularPrazoFinalPA, normalizarTextoHistoricoPrazoPA } from "@/lib/prazo";
import type { SiteSettings } from "@/types/siteSettings";

export function useProcessos(siteSettings?: SiteSettings, authUser?: AuthUser | null) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const dividirEmLotes = <T,>(itens: T[], tamanho: number): T[][] => {
    const lotes: T[][] = [];
    for (let indice = 0; indice < itens.length; indice += tamanho) {
      lotes.push(itens.slice(indice, indice + tamanho));
    }
    return lotes;
  };

  useEffect(() => {
    let unsubProcessos: (() => void) | null = null;

    // Aguarda o Firebase Auth resolver o estado de autenticação antes de inscrever os listeners
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Cancela listeners anteriores se existirem
      if (unsubProcessos) { unsubProcessos(); unsubProcessos = null; }
      if (mergeTimerRef.current) {
        clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = null;
      }

      if (!firebaseUser) {
        setProcessos([]);
        setErro(null);
        setCarregando(false);
        return;
      }

      setProcessos([]);
      setErro(null);
      setCarregando(true);

      const usuarioEfetivo = authUser ?? {
        posto: "",
        nome: firebaseUser.email?.split("@")[0] || "",
        role: "",
        secao: "",
        email: firebaseUser.email || undefined,
        uid: firebaseUser.uid,
      };

      const ehAdmin = isAdmin(usuarioEfetivo);
      const setorUsuario = normalizarSetor(
        usuarioEfetivo.setor || usuarioEfetivo.role || usuarioEfetivo.secao || usuarioEfetivo.cargo,
      );

      let processosCache: any[] = [];

      const carregarResponsaveisLegado = async (processosAtuais: any[]) => {
        const processosPendentes = processosAtuais.filter((procData) => {
          const setorCanonico = normalizarSetor(procData.setor || procData.tipo);
          const responsavelAtual = String(procData.responsavel || "").trim();
          return setorCanonico === "PA" && !responsavelAtual;
        });

        if (processosPendentes.length === 0) {
          return new Map<string, string>();
        }

        const distribuicoesRef = collection(db, "distribuicoes");
        const responsaveisPorProcesso = new Map<string, string>();
        const lotesIds = dividirEmLotes(
          processosPendentes.map((procData) => String(procData.id)),
          10,
        );

        try {
          await Promise.all(
            lotesIds.map(async (loteIds) => {
              const snapshot = await getDocs(
                query(distribuicoesRef, where("processoId", "in", loteIds)),
              );

              snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();
                const processoId = String(data.processoId || "").trim();
                const assessorNome = String(data.assessorNome || "").trim();

                if (processoId && assessorNome && !responsaveisPorProcesso.has(processoId)) {
                  responsaveisPorProcesso.set(processoId, assessorNome);
                }
              });
            }),
          );
        } catch (error) {
          console.warn("⚠️ Não foi possível carregar distribuições legadas por processo:", error);
        }

        return responsaveisPorProcesso;
      };

      const mesclarProcessosAutorizados = () => {
        if (mergeTimerRef.current) clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = setTimeout(() => {
          mergeTimerRef.current = null;

          void (async () => {
            const responsaveisLegado = await carregarResponsaveisLegado(processosCache);
            const listaProcessos: Processo[] = [];
      
            processosCache.forEach((procData) => {
              const setorCanonico = normalizarSetor(procData.setor || procData.tipo);
        
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
              const descricaoUltimoMovimentoOriginal = ultimaMensagem?.texto 
                || procData.ultimaAtualizacaoDescricao 
                || procData.ultimaAcaoDescricao 
                || procData.descricao 
                || "Sem movimentação";

              const dataAssinatura = toIsoString(procData.dataAssinatura) || procData.dataAssinatura;
              const dataInicioPrazo = toIsoString(procData.dataInicioPrazo) || procData.dataInicioPrazo;
              const descricaoUltimoMovimento = normalizarTextoHistoricoPrazoPA(descricaoUltimoMovimentoOriginal, dataInicioPrazo);
              const prorrogacoes = Array.isArray(procData.prorrogacoes) ? procData.prorrogacoes : undefined;
              const prazoFinalPA = calcularPrazoFinalPA({
                tipoPA: procData.tipoPA,
                dataInicioPrazo,
                dataAssinatura,
                prorrogacoes,
              }, siteSettings);
              const prazoFatalProcesso = setorCanonico === "PA"
                ? (prazoFinalPA || procData.prazoFatal || procData.finalPrazo)
                : (procData.prazoFatalDU || procData.prazoFatal || procData.finalPrazo);
              const finalPrazoProcesso = setorCanonico === "PA"
                ? (prazoFinalPA || procData.finalPrazo || procData.prazoFatal)
                : (procData.prazoFatalDU || procData.finalPrazo || procData.prazoFatal);
              const responsavelLegado = responsaveisLegado.get(String(procData.id));

              const processoMapeado: Processo = {
                id: procData.id,
                numero: procData.numeroProcesso || procData.numero || "S/N",
                cliente: procData.parte || procData.cliente || "Não informado",
                vara: procData.vara || "N/A",
                parteContraria: procData.parteContraria || "N/A",
                tipoAcao: procData.assunto || procData.tipoAcao || "Sem assunto",
                responsavel: procData.responsavel || responsavelLegado || procData.encarregado || "",
                prazo: procData.prazoInternoDU || procData.prazo || procData.pedidoSubsidios?.dataPrazo || procData.pedidoSubsidios?.prazoResposta,
                prazoFatal: prazoFatalProcesso,
                descricao: descricaoUltimoMovimento,
                status: statusMapeado,
                criadoEm: toIsoString(procData.criadoEm) || toIsoString(procData.dataEntrada) || new Date().toISOString(),
                tipo: (setorCanonico || procData.tipo || "OUTRO") as any,
                setor: setorCanonico || procData.setor,
                prioridade: (procData.prioridade || "normal") as any,
                secao: procData.secaoDU || procData.secao || "N/A",
                origem: procData.origemDU || procData.origem || "N/A",
                subtipo: procData.tipoPA || procData.subtipo,
                faseAtual: procData.status || procData.faseAtual,
                inicioPrazo: procData.dataInicialPrazo || procData.inicioPrazo,
                finalPrazo: finalPrazoProcesso,
                entrada: procData.dataEntrada || procData.entrada,
                userId: procData.userId || procData.criadoPorId,
                userEmail: procData.userEmail,
                processoReaberto: procData.processoReaberto === true,
                motivoReabertura: procData.motivoReabertura,
                reabertoEm: toIsoString(procData.reabertoEm) || procData.reabertoEm,
                reabertoPorNome: procData.reabertoPorNome,
                origemDU: procData.origemDU,
                secaoDU: procData.secaoDU,
                isMS: procData.isMS || false,
                dataEntrada: toIsoString(procData.dataEntrada) || procData.dataEntrada,
                observacoes: procData.observacoes,
                tipoPA: procData.tipoPA,
                encarregado: procData.encarregado,
                presidenteConselhoPosto: procData.presidenteConselhoPosto,
                presidenteConselhoNome: procData.presidenteConselhoNome,
                omPresidenteConselho: procData.omPresidenteConselho,
                situacaoFluxo: procData.situacaoFluxo,
                primeiraPortaria: procData.primeiraPortaria,
                interessado: procData.interessado || procData.parte,
                dataAssinatura,
                dataInicioPrazo,
                despachoFinal: procData.despachoFinal,
                prorrogacoes,
                decisaoAutNomeante: procData.decisaoAutNomeante,
                numeroDIExRemessa: procData.numeroDIExRemessa,
                resultadoFinalConselho: procData.resultadoFinalConselho,
                teveRecurso: procData.teveRecurso === true,
                membrosConselho: procData.membrosConselho,
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
          })();
        }, 40);
      };

      const processosRef = collection(db, "processos");
      let qProcessos: Query;

      if (ehAdmin) {
        qProcessos = query(processosRef, where("setor", "in", ["DU", "PA"]));
      } else if (setorUsuario) {
        qProcessos = query(processosRef, where("setor", "==", setorUsuario));
      } else {
        qProcessos = query(processosRef, where("userId", "==", firebaseUser.uid));
      }

      unsubProcessos = onSnapshot(
        qProcessos,
        (snapshot) => {
          processosCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          mesclarProcessosAutorizados();
        },
        (err) => {
          console.error("❌ Erro ao buscar processos:", err);
          setErro("Erro ao carregar processos");
          setCarregando(false);
        }
      );
    }); // fecha onAuthStateChanged

    // Cleanup: desinscreve de todos os listeners ao desmontar
    return () => {
      if (mergeTimerRef.current) {
        clearTimeout(mergeTimerRef.current);
        mergeTimerRef.current = null;
      }
      unsubAuth();
      if (unsubProcessos) unsubProcessos();
    };
  }, [authUser, siteSettings]);

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

      // 1. Remove distribuições relacionadas ao processo enquanto o processo pai ainda é acessível pelas rules
      try {
        const distribuicoesRef = collection(db, "distribuicoes");
        const qDistrib = query(distribuicoesRef, where("processoId", "==", id));
        const distribSnapshot = await getDocs(qDistrib);
        const deleteDistribPromises = distribSnapshot.docs.map((docSnap) => deleteDoc(docSnap.ref));
        await Promise.all(deleteDistribPromises);
        // console.log(`✅ ${distribSnapshot.size} distribuições removidas`);
      } catch {
        // sem permissao para limpar distribuicoes em alguns perfis; a exclusao do processo segue normalmente
      }

      // 2. Remove o documento principal do processo (resposta rápida na UI)
      const processoRef = doc(db, "processos", id);
      await deleteDoc(processoRef);
      
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