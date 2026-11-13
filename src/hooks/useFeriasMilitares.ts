import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { registrarErro } from "@/lib/errorLog";

// Os 8 processos de um militar em férias não precisam ir todos para a mesma
// pessoa — cada um pode ser redistribuído para um substituto diferente, por
// isso o rastreio é por processo (não um único substituto por período).
export interface DistribuicaoFerias {
  processoId: string;
  substitutoUid: string;
  substitutoNome: string;
}

export interface FeriasMilitar {
  id: string;
  userId: string;
  nomeMilitar: string;
  posto?: string;
  nomeGuerra?: string;
  // "GERAL" cobre a chefia geral (AsseApAssJur), que não pertence a um
  // setor DU/PA específico — ver resolverSetorFerias em FeriasMilitares.tsx.
  setor: "DU" | "PA" | "GERAL";
  dataInicio: string; // YYYY-MM-DD
  dataRetorno: string; // YYYY-MM-DD
  distribuicoes?: DistribuicaoFerias[];
  processosRedistribuidos?: string[];
  processosRevertidos?: string[];
  // Pares de férias com período sobreposto (militares diferentes) já
  // reconhecidos pela chefia — guarda o id do OUTRO registro do par, ver
  // reconhecerConflito abaixo. Some de cena sozinho quando o período termina,
  // já que conflitos só são calculados entre períodos ainda não concluídos.
  conflitosCientes?: string[];
  criadoPorUid?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export function useFeriasMilitares() {
  const [ferias, setFerias] = useState<FeriasMilitar[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (unsub) { unsub(); unsub = null; }
      if (!fbUser) {
        setFerias([]);
        setCarregando(false);
        return;
      }
      setCarregando(true);
      unsub = onSnapshot(
        collection(db, "feriasMilitares"),
        (snapshot) => {
          const lista = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as FeriasMilitar[];
          setFerias(lista);
          setCarregando(false);
        },
        (err) => {
          console.error("❌ Erro no listener de feriasMilitares:", err);
          registrarErro("useFeriasMilitares.listener", err);
          setCarregando(false);
        },
      );
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, []);

  const criar = async (
    dados: Omit<FeriasMilitar, "id" | "criadoEm" | "atualizadoEm" | "processosRedistribuidos" | "processosRevertidos">,
  ) => {
    const agoraISO = new Date().toISOString();
    await addDoc(collection(db, "feriasMilitares"), {
      ...dados,
      processosRedistribuidos: [],
      processosRevertidos: [],
      criadoEm: agoraISO,
      atualizadoEm: agoraISO,
    });
  };

  // Aplica a distribuição escolhida (um substituto por processo, não
  // necessariamente o mesmo para todos) e registra quais processos foram
  // movidos por causa desta ausência específica — é esta lista que o robô
  // de retorno usa para saber o que devolver automaticamente, sem tocar em
  // processos que o substituto tenha recebido por outro motivo.
  const redistribuir = async (id: string, distribuicoes: DistribuicaoFerias[]) => {
    if (distribuicoes.length === 0) return;
    await updateDoc(doc(db, "feriasMilitares", id), {
      distribuicoes: arrayUnion(...distribuicoes),
      processosRedistribuidos: arrayUnion(...distribuicoes.map((d) => d.processoId)),
      atualizadoEm: new Date().toISOString(),
    });
  };

  const marcarRevertido = async (id: string, processoId: string) => {
    await updateDoc(doc(db, "feriasMilitares", id), {
      processosRedistribuidos: arrayRemove(processoId),
      processosRevertidos: arrayUnion(processoId),
      atualizadoEm: new Date().toISOString(),
    });
  };

  const excluir = async (id: string) => {
    await deleteDoc(doc(db, "feriasMilitares", id));
  };

  // Edição do período sem precisar excluir e recriar o registro — usado
  // tanto pelo próprio militar (seu período) quanto pela chefia (qualquer um).
  const atualizarPeriodo = async (id: string, dataInicio: string, dataRetorno: string) => {
    await updateDoc(doc(db, "feriasMilitares", id), {
      dataInicio,
      dataRetorno,
      atualizadoEm: new Date().toISOString(),
    });
  };

  // Marca como "ciente" um par de períodos sobrepostos entre militares
  // diferentes — grava dos dois lados para que o aviso suma mesmo que um
  // dos dois registros seja consultado isoladamente.
  const reconhecerConflito = async (idA: string, idB: string) => {
    const agoraISO = new Date().toISOString();
    await Promise.all([
      updateDoc(doc(db, "feriasMilitares", idA), { conflitosCientes: arrayUnion(idB), atualizadoEm: agoraISO }),
      updateDoc(doc(db, "feriasMilitares", idB), { conflitosCientes: arrayUnion(idA), atualizadoEm: agoraISO }),
    ]);
  };

  return {
    ferias,
    carregando,
    criar,
    redistribuir,
    marcarRevertido,
    excluir,
    atualizarPeriodo,
    reconhecerConflito,
  };
}
