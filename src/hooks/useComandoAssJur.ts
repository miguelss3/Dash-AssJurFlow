import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { registrarErro } from "@/lib/errorLog";

// V4.3 — Comando da AssJur: documento único (id fixo "atual") que representa
// a delegação de comando vigente ou agendada. Ausente (ou fora da janela
// dataInicio/dataFim) = sem delegação, comportamento normal. Ver
// firestore.rules para a aplicação real do bloqueio ("modo observador").
// V4.8 — "DONO" é o Admin Universal delegando o próprio assento (tudo,
// inclusive branding/contas); "CHEFE_GERAL" é o cargo permanente de Chefe
// Geral da AssJur delegando só o assento dele (poderes operacionais) — ver
// firestore.rules para a separação real de cada um.
export type PapelComando = "DONO" | "CHEFE_GERAL";

export interface ComandoAssJur {
  papel: PapelComando;
  delegadoUid: string;
  delegadoNome: string;
  delegadorUid: string;
  delegadorNome: string;
  dataInicio: string; // YYYY-MM-DD (civil, fuso local)
  dataFim: string; // YYYY-MM-DD (civil, fuso local) — primeiro dia já sem delegação
  criadoEm?: string;
  atualizadoEm?: string;
}

const COMANDO_DOC_ID = "atual";

// Converte Timestamp do Firestore para data civil local "YYYY-MM-DD" — NÃO
// usa toISOString() direto (UTC), que deslocaria o dia em fusos negativos.
function toDataCivil(valor: unknown): string {
  const v = valor as { toDate?: () => Date };
  if (typeof v?.toDate !== "function") return "";
  let d: Date;
  try {
    d = v.toDate();
  } catch {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toIso(valor: unknown): string | undefined {
  const v = valor as { toDate?: () => Date };
  if (typeof v?.toDate !== "function") return undefined;
  try {
    return v.toDate().toISOString();
  } catch {
    return undefined;
  }
}

export function useComandoAssJur() {
  const [comando, setComando] = useState<ComandoAssJur | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (unsub) { unsub(); unsub = null; }
      if (!fbUser) {
        setComando(null);
        setCarregando(false);
        return;
      }
      setCarregando(true);
      unsub = onSnapshot(
        doc(db, "comandoAssJur", COMANDO_DOC_ID),
        (snap) => {
          if (!snap.exists()) {
            setComando(null);
          } else {
            const data = snap.data() as Record<string, unknown>;
            setComando({
              papel: data.papel === "CHEFE_GERAL" ? "CHEFE_GERAL" : "DONO",
              delegadoUid: String(data.delegadoUid || ""),
              delegadoNome: String(data.delegadoNome || ""),
              delegadorUid: String(data.delegadorUid || ""),
              delegadorNome: String(data.delegadorNome || ""),
              dataInicio: toDataCivil(data.dataInicio),
              dataFim: toDataCivil(data.dataFim),
              criadoEm: toIso(data.criadoEm),
              atualizadoEm: toIso(data.atualizadoEm),
            });
          }
          setCarregando(false);
        },
        (err) => {
          console.error("❌ Erro no listener de comandoAssJur:", err);
          registrarErro("useComandoAssJur.listener", err);
          setCarregando(false);
        },
      );
    });
    return () => {
      unsubAuth();
      if (unsub) unsub();
    };
  }, []);

  const delegar = async (dados: {
    papel: PapelComando;
    delegadoUid: string;
    delegadoNome: string;
    delegadorUid: string;
    delegadorNome: string;
    dataInicio: string; // YYYY-MM-DD (civil)
    dataFim: string; // YYYY-MM-DD (civil) — primeiro dia já SEM delegação
  }) => {
    const inicio = new Date(`${dados.dataInicio}T00:00:00`);
    const fim = new Date(`${dados.dataFim}T00:00:00`);
    const agora = Timestamp.now();
    await setDoc(doc(db, "comandoAssJur", COMANDO_DOC_ID), {
      papel: dados.papel,
      delegadoUid: dados.delegadoUid,
      delegadoNome: dados.delegadoNome,
      delegadorUid: dados.delegadorUid,
      delegadorNome: dados.delegadorNome,
      dataInicio: Timestamp.fromDate(inicio),
      dataFim: Timestamp.fromDate(fim),
      criadoEm: agora,
      atualizadoEm: agora,
    });
  };

  const revogar = async () => {
    await deleteDoc(doc(db, "comandoAssJur", COMANDO_DOC_ID));
  };

  return { comando, carregando, delegar, revogar };
}
