import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Processo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

interface AssessoresTickerProps {
  processos: Processo[];
}

type Movimento = "sobe" | "desce" | "mantem";

interface ItemTicker {
  nome: string;
  total: number;
  vencidos: number;
  movimento: Movimento;
}

// Mesmo critério de conclusão usado no resto do app (ver SidebarAssessoresResumo/indicadoresPdf).
function ehConcluido(p: Processo): boolean {
  const statusNorm = String(p.status || "").trim().toLowerCase();
  return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
}

function prazoVencido(p: Processo): boolean {
  return statusPrazo(p.prazoFatal || p.finalPrazo || p.prazo) === "overdue";
}

// Ticker estilo "bolsa de valores" com o ranking de processos por assessor —
// veio da barra lateral (SidebarAssessoresResumo) para a barra superior, que
// aparece em todas as telas. A seta verde/vermelha/bolinha azul compara a
// posição de cada um no ranking (por total de processos) com a última vez
// que este componente recalculou — não com uma data fixa, é "o tick anterior".
export function AssessoresTicker({ processos }: AssessoresTickerProps) {
  const rankAnteriorRef = useRef<Record<string, number>>({});
  const [itens, setItens] = useState<ItemTicker[]>([]);

  useEffect(() => {
    const mapa = new Map<string, { total: number; vencidos: number }>();

    processos.forEach((p) => {
      const nome = (p.responsavel || "").trim();
      if (!nome) return;
      const atual = mapa.get(nome) ?? { total: 0, vencidos: 0 };
      atual.total += 1;
      if (!ehConcluido(p) && prazoVencido(p)) atual.vencidos += 1;
      mapa.set(nome, atual);
    });

    const ordenado = Array.from(mapa.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, dados], rank) => ({ nome, ...dados, rank }));

    const rankAnterior = rankAnteriorRef.current;
    const novosItens: ItemTicker[] = ordenado.map(({ nome, total, vencidos, rank }) => {
      const rankAntigo = rankAnterior[nome];
      let movimento: Movimento = "mantem";
      if (rankAntigo !== undefined) {
        if (rank < rankAntigo) movimento = "sobe";
        else if (rank > rankAntigo) movimento = "desce";
      }
      return { nome, total, vencidos, movimento };
    });

    setItens(novosItens);

    const novoRank: Record<string, number> = {};
    ordenado.forEach(({ nome, rank }) => { novoRank[nome] = rank; });
    rankAnteriorRef.current = novoRank;
  }, [processos]);

  if (itens.length === 0) return null;

  // Duplica a lista para o loop da animação ficar contínuo (sem "salto" ao reiniciar).
  const fita = [...itens, ...itens];

  return (
    <div className="hidden lg:flex flex-1 min-w-0 mx-2 overflow-hidden rounded-full border border-border bg-card/60">
      <div className="flex items-center ticker-fita py-2">
        {fita.map((item, i) => (
          <div key={`${item.nome}-${i}`} className="flex items-center gap-1.5 px-4 text-xs shrink-0 whitespace-nowrap">
            {item.movimento === "sobe" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
            {item.movimento === "desce" && <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            {item.movimento === "mantem" && <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />}
            <span className="font-bold text-foreground">{item.nome}</span>
            <span className="text-muted-foreground font-semibold">{item.total}</span>
            {item.vencidos > 0 && (
              <span className="text-red-500 font-semibold">−{item.vencidos}</span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .ticker-fita {
          animation: ticker-scroll 25s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default AssessoresTicker;
