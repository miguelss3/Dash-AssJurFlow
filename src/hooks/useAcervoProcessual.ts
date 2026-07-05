import { useEffect, useState } from "react";
import type { Processo } from "@/types/processo";
import type { ProcessosStats } from "@/hooks/useProcessosStats";

export interface AcervoProcessual {
  ativosDU: number;
  ativosPA: number;
  acervoAtivo: number;
  totalDU: number;
  totalPA: number;
  totalGeral: number;
  totalConcluidos: number;
  taxaConclusao: number;
  /** Pronto assim que o array de `processos` (ativos + concluídos, ver useProcessos.ts) foi confirmado pelo servidor. */
  ativosProntos: boolean;
  /** Pronto quando as contagens do servidor (useProcessosStats) chegaram, ou o timeout de resiliência expirou. */
  historicoProntos: boolean;
  /** `ativosProntos && historicoProntos` — única condição segura para exibir total/DU/PA/taxaConclusao. */
  prontos: boolean;
}

const TIMEOUT_HISTORICO_MS = 3000;

function setorDe(p: Processo): string {
  return (p.setor || p.tipo || "").toString().toUpperCase();
}

/**
 * Fonte única dos números do card "Acervo Processual" (total, DU, PA, Ativos,
 * % de conclusão) e do respectivo gate de prontidão — compartilhada entre
 * Dashboard.tsx e Estatisticas.tsx.
 *
 * Antes desta extração, cada componente recalculava os mesmos números de
 * forma independente, e o gate que evita renderizar total/DU/PA/Ativos com o
 * array de `processos` ainda incompleto (ver useProcessos.ts — race condition
 * entre os listeners de ativos e concluídos) só tinha sido corrigido em um
 * dos dois lugares, deixando o outro exibir o mesmo bug de números
 * incorretos por 1-2s no carregamento inicial.
 */
export function useAcervoProcessual(
  processos: Processo[],
  loadingProcessos: boolean,
  statsServidor: ProcessosStats,
): AcervoProcessual {
  const [statsTimeout, setStatsTimeout] = useState(false);

  // Tarefa 3 (Dashboard original): fallback de resiliência. Se o servidor
  // demorar mais de 3s para responder às contagens, libera a UI mesmo assim
  // — melhor mostrar dados parciais do que travar o usuário indefinidamente.
  useEffect(() => {
    setStatsTimeout(false);
    const id = setTimeout(() => setStatsTimeout(true), TIMEOUT_HISTORICO_MS);
    return () => clearTimeout(id);
  }, []);

  const processosAtivos = processos.filter((p) => p.status !== "concluido");
  const ativosDU = processosAtivos.filter((p) => setorDe(p) === "DU").length;
  const ativosPA = processosAtivos.filter((p) => setorDe(p) === "PA").length;
  const acervoAtivo = ativosDU + ativosPA;

  // total_setor = ativos_setor (snapshot local, tempo real) + concluidos_setor
  // (contagem do servidor) — o array local `processos` fica limitado a
  // "ativos + últimos 50 concluídos", então contar direto nele subestima o
  // histórico quando ultrapassa 50.
  const totalDU = ativosDU + statsServidor.totalConcluidosDU;
  const totalPA = ativosPA + statsServidor.totalConcluidosPA;
  const totalGeral = totalDU + totalPA;
  const totalConcluidos = statsServidor.totalConcluidos;
  const taxaConclusao = totalGeral > 0 ? Math.round((totalConcluidos / totalGeral) * 100) : 0;

  const ativosProntos = !loadingProcessos;
  const historicoProntos = !statsServidor.carregando || statsTimeout;
  const prontos = ativosProntos && historicoProntos;

  return {
    ativosDU,
    ativosPA,
    acervoAtivo,
    totalDU,
    totalPA,
    totalGeral,
    totalConcluidos,
    taxaConclusao,
    ativosProntos,
    historicoProntos,
    prontos,
  };
}
