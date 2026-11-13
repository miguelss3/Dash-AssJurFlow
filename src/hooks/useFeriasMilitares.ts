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

export interface FeriasMilitar {
  id: string;
  userId: string;
  nomeMilitar: string;
  posto?: string;
  nomeGuerra?: string;
  setor: "DU" | "PA";
  dataInicio: string; // YYYY-MM-DD
  dataRetorno: string; // YYYY-MM-DD
  substitutoUid?: string;
  substitutoNome?: string;
  processosRedistribuidos?: string[];
  processosRevertidos?: string[];
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

  // Aplica a escolha do substituto e registra os processos movidos por causa
  // desta ausência específica — é esta lista que o robô de retorno usa para
  // saber quais processos devolver automaticamente, sem tocar em processos
  // que o substituto tenha recebido por outro motivo.
  const redistribuir = async (
    id: string,
    substitutoUid: string,
    substitutoNome: string,
    processoIds: string[],
  ) => {
    await updateDoc(doc(db, "feriasMilitares", id), {
      substitutoUid,
      substitutoNome,
      processosRedistribuidos: arrayUnion(...processoIds),
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

  return { ferias, carregando, criar, redistribuir, marcarRevertido, excluir };
}
