import { useEffect, useState, useCallback } from "react";
import type { Processo, StatusProcesso } from "@/types/processo";

const STORAGE_KEY = "assjur-flow:processos:v3";

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const SEED: Processo[] = [
  // ===== DU - TEN BECKER =====
  {
    id: crypto.randomUUID(),
    numero: "00407.000998/2026-44",
    cliente: "Clube de Tiro e Caça Ponta Negra",
    vara: "2ª Vara Federal - AM",
    parteContraria: "União Federal",
    tipoAcao: "Anulação de Auto de Infração - Multa administrativa por armazenamento irregular de munição",
    responsavel: "Ten Becker",
    prazo: addDays(2),
    prazoFatal: addDays(5),
    descricao: "Assessor registrou a assinatura do CHEM com DIEx 654.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "normal",
    secao: "SFPC",
    origem: "SAPIENS",
    entrada: addDays(-1),
    faseAtual: "Resposta assinada",
  },
  // ===== DU - TEN PORTELA =====
  {
    id: crypto.randomUUID(),
    numero: "1025202-57.2024.4.01.3200",
    cliente: "CLUBE DE TIRO DO AMAZONAS - CTA",
    vara: "2ª Vara Federal - AM",
    parteContraria: "União Federal",
    tipoAcao: "INTERDIÇÃO CLUBE DE TIRO",
    responsavel: "Ten Portela",
    prazo: addDays(-4),
    prazoFatal: addDays(3),
    descricao: "Processo redistribuído para Ten Portela.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "liminar",
    secao: "SFPC",
    origem: "E-mail",
    entrada: addDays(-7),
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
    origem: "DIEx",
    entrada: addDays(-5),
  },
  // ===== DU - TEN TAMIRES =====
  {
    id: crypto.randomUUID(),
    numero: "0008446-58.2026.4.05.8001",
    cliente: "ANTONIO MARCOS COSTA DOS SANTOS",
    vara: "1ª Vara Federal",
    parteContraria: "União",
    tipoAcao: "Encaminhamento de subsídios",
    responsavel: "Ten Tamires",
    prazo: addDays(0),
    prazoFatal: addDays(0),
    descricao: "Dados do processo DU atualizados.",
    status: "novo",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "urgente",
    secao: "SVP",
    origem: "SAPIENS",
    entrada: addDays(-4),
  },
  // ===== PA - TC PERNINHA =====
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 031/2026",
    cliente: "12ª Inspetoria de Contabilidade e Finanças (12ª ICFEX)",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Apuração de irregularidade em prestação de contas de suprimento de fundos.",
    responsavel: "TC Perninha",
    prazo: addDays(19),
    prazoFatal: addDays(20),
    descricao: "Prazo de diligência iniciado pelo assessor.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "ICFEX",
    origem: "Portaria",
    subtipo: "IPM • Diligência",
    faseAtual: "Em diligência",
    inicioPrazo: addDays(-1),
    finalPrazo: addDays(19),
    entrada: addDays(-1),
  },
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 045/2026",
    cliente: "—",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Suspeita de falsificação de documento público (Atestado Médico)",
    responsavel: "TC Perninha",
    prazo: addDays(39),
    prazoFatal: addDays(45),
    descricao: "Aguardando designação de encarregado adjunto.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "SVP",
    origem: "Ofício",
    subtipo: "IPM",
    faseAtual: "Portaria assinada",
    entrada: addDays(-2),
  },
  // ===== PA - TEN FABRA =====
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 12",
    cliente: "Cel Oswaldo Ribeiro / SVP 12",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Outro - Alterações constantes no Relatório de Exame de Pagamento de Pessoal Militar",
    responsavel: "Ten Fabra",
    prazo: addDays(25),
    prazoFatal: addDays(30),
    descricao: "Portaria assinada pelo Cmt.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "SVP",
    origem: "DIEx",
    subtipo: "Sindicância",
    faseAtual: "Portaria assinada",
    entrada: addDays(-3),
  },
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 23/2025",
    cliente: "—",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Sindicância administrativa",
    responsavel: "Ten Fabra",
    prazo: addDays(-3),
    prazoFatal: addDays(-1),
    descricao: "Atrasado - aguardando relatório final.",
    status: "andamento",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "urgente",
    secao: "SVP",
    origem: "Portaria",
    subtipo: "Sindicância",
    faseAtual: "Atrasado",
    entrada: addDays(-90),
  },
  // ===== PA - TEN GLAUCIA =====
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 21/2025",
    cliente: "Recadastro Fusex",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Recadastro Fusex - Para Assinatura",
    responsavel: "Ten Glaucia",
    prazo: addDays(7),
    prazoFatal: addDays(15),
    descricao: "Distribuído para Ten Glaucia.",
    status: "novo",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "Pensões",
    origem: "SAPIENS",
    subtipo: "Sindicância",
    faseAtual: "Para assinatura",
    entrada: addDays(-2),
  },
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 25/2025",
    cliente: "Recadastro Fusex",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Recadastro Fusex - Para Assinatura",
    responsavel: "Ten Glaucia",
    prazo: addDays(10),
    prazoFatal: addDays(20),
    descricao: "Distribuído para Ten Glaucia.",
    status: "novo",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "Pensões",
    origem: "SAPIENS",
    subtipo: "Sindicância",
    faseAtual: "Para assinatura",
    entrada: addDays(-1),
  },
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 14/2025",
    cliente: "—",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Sindicância - Para Assinatura",
    responsavel: "Ten Glaucia",
    prazo: addDays(12),
    prazoFatal: addDays(25),
    descricao: "Aguardando assinatura do Cmt.",
    status: "novo",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "Disciplina",
    origem: "Portaria",
    subtipo: "Sindicância",
    faseAtual: "Para assinatura",
    entrada: addDays(-3),
  },
  // ===== Concluídos =====
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 99/2024",
    cliente: "Arquivo histórico",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "PMM - Promoção militar",
    responsavel: "TC Perninha",
    prazo: addDays(-90),
    prazoFatal: addDays(-60),
    descricao: "Relatório homologado e arquivado.",
    status: "concluido",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "PMM",
    origem: "Portaria",
    subtipo: "Sindicância",
    faseAtual: "Concluído",
  },
  {
    id: crypto.randomUUID(),
    numero: "0099988-77.2023.4.05.0100",
    cliente: "Maj Reformado da Silva",
    vara: "5ª Vara Federal",
    parteContraria: "União",
    tipoAcao: "Pensão militar - parecer favorável",
    responsavel: "Ten Becker",
    prazo: addDays(-45),
    prazoFatal: addDays(-30),
    descricao: "Parecer encaminhado e processo arquivado.",
    status: "concluido",
    criadoEm: new Date().toISOString(),
    tipo: "DU",
    prioridade: "normal",
    secao: "Pensões",
    origem: "SAPIENS",
  },
  {
    id: crypto.randomUUID(),
    numero: "Portaria Nr 88/2024",
    cliente: "—",
    vara: "—",
    parteContraria: "—",
    tipoAcao: "Disciplina - Conselho de Justificação",
    responsavel: "Ten Fabra",
    prazo: addDays(-120),
    prazoFatal: addDays(-90),
    descricao: "Conselho concluído com solução publicada.",
    status: "concluido",
    criadoEm: new Date().toISOString(),
    tipo: "PA",
    prioridade: "normal",
    secao: "Disciplina",
    origem: "Portaria",
    subtipo: "Sindicância",
    faseAtual: "Concluído",
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
