import { useEffect, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type TipoEvento = "prazo" | "feriado" | "sem_expediente" | "audiencia" | "reuniao";

export interface EventoCalendario {
  id: string;
  data: string; // ISO yyyy-mm-dd
  titulo: string;
  descricao?: string;
  tipo: TipoEvento;
  criadoPor: string;
  criadoEm: string;
  setor: "DU" | "PA";
}

function toIsoString(value: any): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  return new Date().toISOString();
}

export function useEventosCalendario(setor: "DU" | "PA" | "", ehAdmin?: boolean) {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);

  useEffect(() => {
    if (!setor && !ehAdmin) {
      setEventos([]);
      return;
    }

    const eventosRef = collection(db, "eventosCalendario");
    const q = ehAdmin
      ? query(eventosRef)
      : query(eventosRef, where("setor", "==", setor));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            data: String(data.data || ""),
            titulo: String(data.titulo || ""),
            descricao: data.descricao ? String(data.descricao) : undefined,
            tipo: (data.tipo || "prazo") as TipoEvento,
            criadoPor: String(data.criadoPor || "Sistema"),
            criadoEm: toIsoString(data.criadoEm),
            setor: ((data.setor || setor || "DU") as "DU" | "PA"),
          } satisfies EventoCalendario;
        });
        lista.sort((a, b) => a.data.localeCompare(b.data));
        setEventos(lista);
      },
      () => {
        setEventos([]);
      },
    );

    return () => unsubscribe();
  }, [setor, ehAdmin]);

  const criar = useCallback(async (e: Omit<EventoCalendario, "id" | "criadoEm">) => {
    const payload = {
      ...e,
      criadoEm: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "eventosCalendario"), payload);
    return {
      ...e,
      id: ref.id,
      criadoEm: new Date().toISOString(),
    } satisfies EventoCalendario;
  }, []);

  const remover = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "eventosCalendario", id));
  }, []);

  return { eventos, criar, remover };
}
