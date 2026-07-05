import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  getCountFromServer,
  query,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/hooks/useAuth";

/**
 * V9.8 — Fonte ÚNICA de verdade para totais históricos do acervo.
 *
 * Tanto o Dashboard quanto a tela de Indicadores de Gestão (Estatisticas)
 * exibiam números divergentes porque cada um calculava do seu jeito:
 *  - Dashboard usava `getCountFromServer` apenas para o total geral de
 *    concluídos, e os badges DU/PA mostravam só ATIVOS.
 *  - Estatisticas usava `processos.length` direto do array local, que está
 *    limitado a "ativos + últimos 50 concluídos" (ver useProcessos.ts).
 *
 * Este hook consolida as contagens reais do servidor, separadas por setor,
 * para que ambas as telas usem a MESMA fórmula:
 *     total_DU = ativos_DU + concluidos_DU (servidor)
 *     total_PA = ativos_PA + concluidos_PA (servidor)
 *     total    = total_DU + total_PA
 *
 * Estes contadores são histórico "quase estático" (só mudam quando um
 * processo é concluído) — não há necessidade de onSnapshot em tempo real.
 * Em vez disso: uma consulta única ao montar + refresh automático a cada
 * 60s + `refresh()` exposto para atualização manual (botão na UI).
 */
export interface ProcessosStats {
  totalConcluidos: number;
  totalConcluidosDU: number;
  totalConcluidosPA: number;
  carregando: boolean;
  refresh: () => void;
}

const STATS_INICIAIS: Omit<ProcessosStats, "refresh"> = {
  totalConcluidos: 0,
  totalConcluidosDU: 0,
  totalConcluidosPA: 0,
  carregando: true,
};

const INTERVALO_REFRESH_MS = 60_000;

export function useProcessosStats(): ProcessosStats {
  const { user } = useAuth();
  const ehAdmin = isAdmin(user);
  const setorUsuario = String(user?.setor || "").trim().toUpperCase();
  const escopoSetor =
    !ehAdmin && (setorUsuario === "DU" || setorUsuario === "PA") ? setorUsuario : null;

  const [stats, setStats] = useState<Omit<ProcessosStats, "refresh">>(STATS_INICIAIS);
  const carregarRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!user) return;
    let cancelado = false;

    const carregar = async () => {
      const processosRef = collection(db, "processos");

      // Escopo: admin → DU+PA; usuário comum → seu setor; sem setor → nada (0).
      // Para queries por setor específico, ignoramos o escopoBase agregador.
      const escopoBase: QueryConstraint[] = escopoSetor
        ? [where("setor", "==", escopoSetor)]
        : ehAdmin
          ? [where("setor", "in", ["DU", "PA"])]
          : [];

      try {
        // Contagem TOTAL de concluídos (no escopo do usuário)
        const qConcluidos = query(
          processosRef,
          ...escopoBase,
          where("status", "==", "concluido"),
        );

        // Contagens por setor (respeita escopo: se usuário é de DU, PA fica 0)
        const podeContarDU = ehAdmin || escopoSetor === "DU";
        const podeContarPA = ehAdmin || escopoSetor === "PA";

        const promises: Promise<number>[] = [
          getCountFromServer(qConcluidos).then((s) => s.data().count),
          podeContarDU
            ? getCountFromServer(
                query(
                  processosRef,
                  where("setor", "==", "DU"),
                  where("status", "==", "concluido"),
                ),
              ).then((s) => s.data().count)
            : Promise.resolve(0),
          podeContarPA
            ? getCountFromServer(
                query(
                  processosRef,
                  where("setor", "==", "PA"),
                  where("status", "==", "concluido"),
                ),
              ).then((s) => s.data().count)
            : Promise.resolve(0),
        ];

        const [totalConcluidos, totalConcluidosDU, totalConcluidosPA] = await Promise.all(promises);

        if (cancelado) return;
        setStats({
          totalConcluidos,
          totalConcluidosDU,
          totalConcluidosPA,
          carregando: false,
        });
      } catch (err) {
        console.error("useProcessosStats: falha ao contar concluídos:", err);
        if (cancelado) return;
        setStats((prev) => ({ ...prev, carregando: false }));
      }
    };

    carregarRef.current = carregar;
    void carregar();

    // Refresh periódico: estes contadores não precisam de listener em tempo
    // real (mudam pouco), mas também não devem ficar parados indefinidamente
    // entre um mount e outro — um intervalo de 60s mantém o dado razoavelmente
    // fresco sem manter uma conexão aberta.
    const intervalId = setInterval(() => {
      void carregar();
    }, INTERVALO_REFRESH_MS);

    return () => {
      cancelado = true;
      clearInterval(intervalId);
    };
  }, [user, ehAdmin, escopoSetor]);

  const refresh = useCallback(() => {
    void carregarRef.current();
  }, []);

  return { ...stats, refresh };
}
