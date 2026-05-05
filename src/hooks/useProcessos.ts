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
  writeBatch,
  orderBy,
  limit,
  Timestamp,
  type Query,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "sonner";
import type { Processo, StatusProcesso, TipoProcesso, Prioridade } from "@/types/processo";
import { isAdmin, type AuthUser } from "./useAuth";

// Sentinela de m\u00f3dulo: garante que a recupera\u00e7\u00e3o de "fantasmas" (docs sem o
// campo `ativo`) rode no m\u00e1ximo UMA vez por sess\u00e3o do navegador, mesmo que o
// hook seja remontado (StrictMode, troca de rota, etc.).
let recuperacaoFantasmasExecutada = false;
import { calcularPrazoFinalPA, normalizarTextoHistoricoPrazoPA } from "@/lib/prazo";
import type { SiteSettings } from "@/types/siteSettings";

export function useProcessos(siteSettings?: SiteSettings, authUser?: AuthUser | null) {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const mergeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limparCamposUndefined = <T extends Record<string, unknown>>(obj: T): Partial<T> => {
    return Object.fromEntries(
      Object.entries(obj).filter(([, valor]) => valor !== undefined)
    ) as Partial<T>;
  };

  const toIsoString = (valor: unknown): string | undefined => {
    if (!valor) return undefined;
    if (typeof valor === "string") return valor;
    if (valor instanceof Date) return valor.toISOString();
    const v = valor as Record<string, unknown>;
    if (typeof v?.toDate === "function") return (v.toDate as () => Date)().toISOString();
    if (typeof v?.seconds === "number") return new Date(v.seconds * 1000).toISOString();
    return undefined;
  };

  const normalizarSetor = (valor: unknown): "DU" | "PA" | "" => {
    const txt = String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();

    if (!txt) return "";
    if (
      txt === "DU"
      || /(^|\s)DU($|\s)/.test(txt)
      || txt.includes("DEFESA")
      || txt.includes("USUARIO")
    ) return "DU";
    if (
      txt === "PA"
      || /(^|\s)PA($|\s)/.test(txt)
      || txt.includes("PROCESSO")
      || txt.includes("ASSESSOR PA")
      || txt.includes("CHEFE PA")
      || txt.includes("ASSJUR")
      || txt.includes("ADMIN")
    ) return "PA";
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
    let unsubConcluidos: (() => void) | null = null;

    // Aguarda o Firebase Auth resolver o estado de autenticação antes de inscrever os listeners
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // Cancela listeners anteriores se existirem
      if (unsubProcessos) { unsubProcessos(); unsubProcessos = null; }
      if (unsubConcluidos) { unsubConcluidos(); unsubConcluidos = null; }
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

      // ---------- RECUPERA\u00c7\u00c3O DE EMERG\u00caNCIA: processos "fantasmas" ----------
      // Os listeners principais usam `where("ativo","==",true|false)`, que NUNCA
      // retorna documentos sem o campo `ativo`. Processos antigos (ou criados
      // durante a janela em que o cadastro n\u00e3o injetava a flag) ficam invis\u00edveis.
      // Aqui, apenas um admin varre a cole\u00e7\u00e3o, identifica os "\u00f3rf\u00e3os" e
      // injeta `ativo` derivado do status (`concluido` -> false; sen\u00e3o true).
      // \u00c9 uma rotina ONE-SHOT por sess\u00e3o (sentinela de m\u00f3dulo).
      if (ehAdmin && !recuperacaoFantasmasExecutada) {
        recuperacaoFantasmasExecutada = true;
        void (async () => {
          try {
            const snap = await getDocs(
              query(collection(db, "processos"), where("setor", "in", ["DU", "PA"])),
            );
            const fantasmas = snap.docs.filter((d) => {
              const data = d.data() as { ativo?: unknown };
              return data.ativo === undefined || data.ativo === null;
            });
            if (fantasmas.length === 0) return;

            console.warn(
              `\u26a0\ufe0f Recupera\u00e7\u00e3o de fantasmas: encontrados ${fantasmas.length} processo(s)` +
                ` sem o campo 'ativo'. Aplicando corre\u00e7\u00e3o autom\u00e1tica...`,
            );

            // Firestore limita writeBatch a 500 ops; dividimos por seguran\u00e7a.
            const lotes = dividirEmLotes(fantasmas, 400);
            for (const lote of lotes) {
              const batch = writeBatch(db);
              for (const docSnap of lote) {
                const data = docSnap.data() as { status?: string };
                const statusNorm = (data.status || "").toString().toLowerCase().trim();
                const novoAtivo = statusNorm !== "concluido" && statusNorm !== "finalizado";
                batch.update(docSnap.ref, { ativo: novoAtivo });
              }
              await batch.commit();
            }

            console.warn(
              `\u2705 Recupera\u00e7\u00e3o conclu\u00edda: ${fantasmas.length} processo(s) agora aparecem nos listeners.`,
            );
          } catch (err) {
            console.error("\u274c Falha na recupera\u00e7\u00e3o de fantasmas:", err);
            // Permite nova tentativa em sess\u00f5es futuras se a primeira falhar.
            recuperacaoFantasmasExecutada = false;
          }
        })();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let processosCacheAtivos: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let processosCacheConcluidos: any[] = [];

      // V2.13 — Optimistic UI: liberamos o carregamento assim que QUALQUER
      // snapshot chegar (cache local OU servidor). O Firestore já emite
      // snapshots subsequentes automaticamente quando o servidor confirmar,
      // então não precisamos bloquear a UI esperando `fromCache=false`.

      // ARQUITETURA HÍBRIDA: o snapshot principal traz só ATIVOS (performance);
      // um segundo listener traz os ÚLTIMOS 50 concluídos para popular a aba
      // "Concluídos" do Kanban sem inflar memória.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const combinarCaches = (): any[] => {
        if (processosCacheAtivos.length === 0) return processosCacheConcluidos;
        if (processosCacheConcluidos.length === 0) return processosCacheAtivos;
        // Dedup por id (defensivo: um doc não deve estar nos dois caches).
        const vistos = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const combinado: any[] = [];
        for (const item of processosCacheAtivos) {
          if (item?.id && !vistos.has(item.id)) {
            vistos.add(item.id);
            combinado.push(item);
          }
        }
        for (const item of processosCacheConcluidos) {
          if (item?.id && !vistos.has(item.id)) {
            vistos.add(item.id);
            combinado.push(item);
          }
        }
        return combinado;
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const processosCache = combinarCaches();
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
                responsavel: procData.responsavel || responsavelLegado || (setorCanonico === "PA" ? (procData.criadoPorNome || procData.atualizadoPorNome || "") : ""),
                prazo: procData.prazoInternoDU || procData.prazo || procData.pedidoSubsidios?.dataPrazo || procData.pedidoSubsidios?.prazoResposta,
                prazoFatal: prazoFatalProcesso,
                descricao: descricaoUltimoMovimento,
                status: statusMapeado,
                criadoEm: toIsoString(procData.criadoEm) || toIsoString(procData.dataEntrada) || new Date().toISOString(),
                tipo: (setorCanonico || procData.tipo || "OUTRO") as TipoProcesso,
                setor: setorCanonico || procData.setor,
                prioridade: (procData.prioridade || "normal") as Prioridade,
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
                ultimaAcaoFluxo: procData.ultimaAcaoFluxo
                  ? {
                      ...procData.ultimaAcaoFluxo,
                      criadoEm: toIsoString(procData.ultimaAcaoFluxo?.criadoEm) || procData.ultimaAcaoFluxo?.criadoEm,
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
            setErro(null);
          })();
        }, 40);
      };

      const processosRef = collection(db, "processos");
      let qProcessos: Query;

      if (ehAdmin) {
        qProcessos = query(
          processosRef,
          where("ativo", "==", true),
          where("setor", "in", ["DU", "PA"]),
        );
      } else if (setorUsuario) {
        qProcessos = query(
          processosRef,
          where("ativo", "==", true),
          where("setor", "==", setorUsuario),
        );
      } else {
        qProcessos = query(
          processosRef,
          where("ativo", "==", true),
          where("userId", "==", firebaseUser.uid),
        );
      }

      unsubProcessos = onSnapshot(
        qProcessos,
        (snapshot) => {
          processosCacheAtivos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          mesclarProcessosAutorizados();
          // V2.13 — Optimistic UI: libera a tela imediatamente, mesmo com
          // snapshot do cache local. O servidor confirmará em segundo plano.
          setCarregando(false);
        },
        (err) => {
          console.error(
            "❌ Erro no listener de processos ATIVOS:" +
              " Verifique se o índice composto do Firestore foi criado" +
              " (setor + ativo). Abra o link sugerido no console do Firebase.",
            err,
          );          // Captura agressiva: o Firestore SDK loga o link de criação do índice
          // como warning silencioso. Surfaceamos via toast persistente para o
          // admin clicar no console e provisionar o índice imediatamente.
          const codigo = (err as { code?: string })?.code;
          if (codigo === "failed-precondition") {
            toast.error(
              "Índice do Firestore ausente (processos ativos). Abra o console do navegador (F12) e clique no link gerado pelo Firebase para criar o índice composto.",
              { duration: Infinity, id: "firestore-index-ativos" },
            );
          }          setErro("Erro ao carregar processos");
          // Mesmo em erro, liberamos o gate para evitar UI travada em "…".
          setCarregando(false);
        }
      );

      // ---------- Listener B: ÚLTIMOS 50 CONCLUÍDOS (para a aba "Concluídos" do Kanban) ----------
      // Usa o mesmo escopo (admin / setor / userId) porém com `ativo == false` e ordenado
      // por `atualizadoEm` desc + limit(50). Se o índice composto não existir, o erro é
      // capturado e o app segue funcionando — basta abrir o link do Firebase no console.
      let qConcluidos: Query;
      if (ehAdmin) {
        qConcluidos = query(
          processosRef,
          where("ativo", "==", false),
          where("setor", "in", ["DU", "PA"]),
          orderBy("atualizadoEm", "desc"),
          limit(50),
        );
      } else if (setorUsuario) {
        qConcluidos = query(
          processosRef,
          where("ativo", "==", false),
          where("setor", "==", setorUsuario),
          orderBy("atualizadoEm", "desc"),
          limit(50),
        );
      } else {
        qConcluidos = query(
          processosRef,
          where("ativo", "==", false),
          where("userId", "==", firebaseUser.uid),
          orderBy("atualizadoEm", "desc"),
          limit(50),
        );
      }

      unsubConcluidos = onSnapshot(
        qConcluidos,
        (snapshot) => {
          processosCacheConcluidos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          mesclarProcessosAutorizados();
          // V2.13 — Optimistic UI: libera a tela imediatamente.
          setCarregando(false);
        },
        (err) => {
          console.error(
            "❌ Erro no listener de processos CONCLUÍDOS:" +
              " Verifique se o índice composto do Firestore foi criado" +
              " (setor + ativo + atualizadoEm desc). Abra o link sugerido no console do Firebase." +
              " A aba 'Concluídos' do Kanban pode ficar vazia até o índice ser provisionado.",
            err,
          );
          const codigo = (err as { code?: string })?.code;
          if (codigo === "failed-precondition") {
            toast.error(
              "Índice do Firestore ausente (processos concluídos). Abra o console do navegador (F12) e clique no link gerado pelo Firebase para criar o índice composto.",
              { duration: Infinity, id: "firestore-index-concluidos" },
            );
          }
          // Não seta erro global: a UI dos ativos continua funcionando.
          processosCacheConcluidos = [];
          mesclarProcessosAutorizados();
          // Libera o gate — sem este listener, concluídos históricos virão pelo
          // getCountFromServer do Dashboard de qualquer forma.
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
      if (unsubConcluidos) unsubConcluidos();
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
        // Flag de infraestrutura: todo novo processo nasce ATIVO
        // (necessária para aparecer no listener filtrado por where("ativo","==",true)).
        ativo: true,
      } as Record<string, unknown>;

      const novoProcessoLimpo = limparCamposUndefined(novoProcesso);
      const novoDocRef = await addDoc(processosRef, novoProcessoLimpo);
      return novoDocRef.id;
      // console.log("✅ Processo criado com sucesso para", currentUser.email);
    } catch (err: unknown) {
      console.error("❌ Erro ao criar processo:", err);
      throw err;
    }
  };

  // Função para atualizar processo existente
  const atualizar = async (id: string, dados: Partial<Processo>) => {
    try {
      const processoRef = doc(db, "processos", id);

      // Sincroniza a flag de infraestrutura `ativo` com o status quando ele é alterado.
      // Se o status mudar para "concluido", o processo é arquivado (ativo:false) e some
      // do listener principal. Qualquer outro status reativa o processo (ativo:true).
      const dadosComAtivo = dados as Partial<Processo> & { ativo?: boolean };
      if (Object.prototype.hasOwnProperty.call(dados, "status")) {
        dadosComAtivo.ativo = dados.status !== "concluido";
      }

      const dadosLimpos = limparCamposUndefined(dadosComAtivo as Record<string, unknown>);
      if (Object.keys(dadosLimpos).length === 0) return;

      await updateDoc(processoRef, dadosLimpos);
      // console.log("✅ Processo atualizado com sucesso");
    } catch (err: unknown) {
      console.error("❌ Erro ao atualizar processo:", err);
      throw err;
    }
  };

  // Função para remover processo e todos os dados relacionados
  const remover = async (id: string) => {
    try {
      // Exclusão atômica: se qualquer delete falhar (permissão/rede), nada é removido.
      const batch = writeBatch(db);

      const distribuicoesRef = collection(db, "distribuicoes");
      const qDistrib = query(distribuicoesRef, where("processoId", "==", id));
      const distribSnapshot = await getDocs(qDistrib);
      distribSnapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      const processoRef = doc(db, "processos", id);
      batch.delete(processoRef);
      await batch.commit();
      
      // console.log(`✅ Processo ${id} e todos os dados relacionados foram excluídos permanentemente`);
    } catch (err: unknown) {
      console.error("❌ Erro ao remover processo:", err);
      throw err;
    }
  };

  // Função para mover processo para outro status (Kanban)
  const moverStatus = async (id: string, novoStatus: StatusProcesso) => {
    try {
      await atualizar(id, { status: novoStatus });
      // console.log(`✅ Processo movido para: ${novoStatus}`);
    } catch (err: unknown) {
      console.error("❌ Erro ao mover processo:", err);
      throw err;
    }
  };

  // -------------------------------------------------------------------
  // V3.5 — Robô Vigia do Kanban DU.
  // Varre processos DU em AGUARDANDO_RESPOSTA cujo prazo já venceu por
  // mais de 1 dia de tolerância e os devolve automaticamente à mesa do
  // assessor, limpando número/prazo e incrementando o contador de
  // reiterações. Usa dot notation no updateDoc para não sobrescrever os
  // demais campos de `pedidoSubsidios`.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!processos || processos.length === 0) return;

    const varrerProcessosVencidos = async () => {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const processosParaVerificar = processos.filter((p) => {
        const extra = p as unknown as { finalizado?: boolean; ativo?: boolean };
        return (
          p.setor === "DU"
          && p.pedidoSubsidios?.situacaoFluxo === "AGUARDANDO_RESPOSTA"
          && extra.finalizado !== true
          && extra.ativo !== false
        );
      });

      for (const p of processosParaVerificar) {
        const prazoStr =
          (p as unknown as Record<string, string | undefined>).prazoFatalDU
          || p.prazoFatal
          || p.pedidoSubsidios?.dataPrazo
          || p.pedidoSubsidios?.prazoResposta;
        if (!prazoStr) continue;

        const dataPrazo = new Date(`${prazoStr}T00:00:00`);
        if (Number.isNaN(dataPrazo.getTime())) continue;
        const dataLimite = new Date(dataPrazo);
        dataLimite.setDate(dataLimite.getDate() + 1);

        if (hoje > dataLimite) {
          try {
            const processoRef = doc(db, "processos", p.id);
            const reiteracoesAtual = Number(p.pedidoSubsidios?.reiteracoes) || 0;
            const msgSistema =
              "🤖 SISTEMA: Prazo vencido com tolerância ultrapassada. Processo retornado automaticamente para a mesa do assessor para providências de reiteração.";

            await updateDoc(processoRef, {
              "pedidoSubsidios.situacaoFluxo": "MESA_ASSESSOR",
              "pedidoSubsidios.numeroDocumentoDU": "",
              "pedidoSubsidios.dataPrazo": "",
              "pedidoSubsidios.reiteracoes": reiteracoesAtual + 1,
              prazoFatalDU: null,
              prazoFatal: null,
              finalPrazo: null,
              status: "Mesa do Assessor",
              descricao: msgSistema,
              atualizadoEm: Timestamp.now(),
              atualizadoPorNome: "Robô do Sistema",
            });

            await addDoc(collection(db, `processos/${p.id}/historico`), {
              autor: "Robô do Sistema",
              autorId: "sistema",
              texto: msgSistema,
              timestamp: new Date().toISOString(),
            });

            console.log(`🤖 Vigia: Processo ${p.numero} resgatado automaticamente!`);
          } catch (error) {
            console.error("Erro no Robô Vigia ao tentar resgatar processo:", error);
          }
        }
      }
    };

    void varrerProcessosVencidos();
  }, [processos]);

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