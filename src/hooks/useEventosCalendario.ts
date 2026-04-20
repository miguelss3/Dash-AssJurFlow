import { useEffect, useState, useCallback } from "react";

export type TipoEvento = "prazo" | "feriado" | "sem_expediente" | "audiencia" | "reuniao";

export interface EventoCalendario {
  id: string;
  data: string; // ISO yyyy-mm-dd
  titulo: string;
  descricao?: string;
  tipo: TipoEvento;
  criadoPor: string;
  criadoEm: string;
}

const STORAGE_KEY = "assjur-flow:eventos-calendario:v1";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

const SEED: EventoCalendario[] = [
  {
    id: crypto.randomUUID(),
    data: addDaysISO(3),
    titulo: "Feriado Nacional - Tiradentes",
    tipo: "feriado",
    criadoPor: "Maj Miguel",
    criadoEm: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    data: addDaysISO(7),
    titulo: "Sem expediente - Manutenção elétrica",
    descricao: "Quartel sem expediente das 08h às 18h.",
    tipo: "sem_expediente",
    criadoPor: "Maj Miguel",
    criadoEm: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(),
    data: addDaysISO(10),
    titulo: "Reunião de coordenação AssJur",
    descricao: "Pauta: redistribuição de processos vencidos.",
    tipo: "reuniao",
    criadoPor: "Maj Miguel",
    criadoEm: new Date().toISOString(),
  },
];

export function useEventosCalendario() {
  const [eventos, setEventos] = useState<EventoCalendario[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setEventos(JSON.parse(raw));
      } else {
        setEventos(SEED);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      }
    } catch {
      setEventos(SEED);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos));
  }, [eventos, loaded]);

  const criar = useCallback((e: Omit<EventoCalendario, "id" | "criadoEm">) => {
    setEventos((prev) => [
      ...prev,
      { ...e, id: crypto.randomUUID(), criadoEm: new Date().toISOString() },
    ]);
  }, []);

  const remover = useCallback((id: string) => {
    setEventos((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { eventos, criar, remover };
}
