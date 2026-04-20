import { useEffect, useState, useCallback } from "react";
import type { Processo, StatusProcesso } from "@/types/processo";

const STORAGE_KEY = "juris-board:processos:v2";

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const SEED: Processo[] = [
  {
    id: crypto.randomUUID(),
    numero: "1025202-57.2024.4.01.3200",
    cliente: "Clube de Tiro do Amazonas - CTA",
    vara: "2ª Vara Federal - AM",
    parteContraria: "União Federal",
    tipoAcao: "Interdição Clube de Tiro",
    responsavel: "Ten Portela",
    prazo: addDays(-2),
    prazoFatal: addDays(3),
    descricao: "Liminar deferida. Manifestação pendente sobre cumprimento.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "liminar",
    secao: "SFPC",
    origem: "E-mail",
  },
  {
    id: crypto.randomUUID(),
    numero: "1001085-12.2018.4.01.3200",
    cliente: "Alciney Gomes Leite",
    vara: "1ª Vara Federal",
    parteContraria: "União",
    tipoAcao: "Reintegrados - Parecer",
    responsavel: "Ten Portela",
    prazo: addDays(1),
    prazoFatal: addDays(4),
    descricao: "Parecer técnico em elaboração para subsidiar manifestação.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "normal",
    secao: "SVP",
    origem: "DiEx",
  },
  {
    id: crypto.randomUUID(),
    numero: "0098765-43.2024.8.26.0224",
    cliente: "João Pereira Ltda",
    vara: "3ª Vara Empresarial",
    parteContraria: "Fornecedora ABC",
    tipoAcao: "Cobrança",
    responsavel: "Dra. Ana Lima",
    prazo: addDays(0),
    prazoFatal: addDays(7),
    descricao: "Audiência de conciliação marcada. Preparar minuta de acordo.",
    status: "audiencia",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "urgente",
    secao: "SFPC",
    origem: "Ofício",
  },
  {
    id: crypto.randomUUID(),
    numero: "0055544-22.2024.8.26.0011",
    cliente: "Tech Innovations S/A",
    vara: "4ª Vara do Trabalho",
    parteContraria: "Ex-funcionário",
    tipoAcao: "Reclamação Trabalhista",
    responsavel: "Dr. Carlos Mendes",
    prazo: addDays(3),
    prazoFatal: addDays(10),
    descricao: "Recurso ordinário em fase de elaboração.",
    status: "recurso",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "SVP",
    origem: "Sistema",
  },
  {
    id: crypto.randomUUID(),
    numero: "0011122-33.2024.8.26.0500",
    cliente: "Construtora Horizonte",
    vara: "1ª Vara Cível",
    parteContraria: "Município de São Paulo",
    tipoAcao: "Mandado de Segurança",
    responsavel: "Dra. Ana Lima",
    prazo: addDays(15),
    prazoFatal: addDays(30),
    descricao: "Aguardando designação de relator.",
    status: "novo",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "normal",
    secao: "SFPC",
    origem: "E-mail",
  },
  {
    id: crypto.randomUUID(),
    numero: "0099988-77.2023.8.26.0100",
    cliente: "Carlos Oliveira",
    vara: "5ª Vara de Família",
    parteContraria: "Inventariante",
    tipoAcao: "Inventário",
    responsavel: "Dr. Roberto Souza",
    prazo: addDays(45),
    prazoFatal: addDays(60),
    descricao: "Processo arquivado após partilha homologada.",
    status: "concluido",
    criadoEm: new Date().toISOString(),
    tipo: "OUTRO",
    prioridade: "normal",
    secao: "SVP",
    origem: "Sistema",
  },
];

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setProcessos(JSON.parse(raw));
      } else {
        setProcessos(SEED);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
      }
    } catch {
      setProcessos(SEED);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(processos));
    }
  }, [processos, loaded]);

  const criar = useCallback((p: Omit<Processo, "id" | "criadoEm">) => {
    setProcessos((prev) => [
      ...prev,
      { ...p, id: crypto.randomUUID(), criadoEm: new Date().toISOString() },
    ]);
  }, []);

  const atualizar = useCallback((id: string, dados: Partial<Processo>) => {
    setProcessos((prev) => prev.map((p) => (p.id === id ? { ...p, ...dados } : p)));
  }, []);

  const remover = useCallback((id: string) => {
    setProcessos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const moverStatus = useCallback((id: string, status: StatusProcesso) => {
    setProcessos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }, []);

  return { processos, loaded, criar, atualizar, remover, moverStatus };
}
