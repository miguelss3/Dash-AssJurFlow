import { useMemo } from "react";
import { Users } from "lucide-react";
import type { Processo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

interface SidebarAssessoresResumoProps {
  processos: Processo[];
}

interface ResumoAssessor {
  nome: string;
  total: number;
  ativos: number;
  finalizados: number;
  noPrazo: number;
  vencidos: number;
}

// Mesmo critério de conclusão usado no resto do app (MesaPA/MesaDU/relatórios
// PDF): `status === "concluido"` sozinho não pega `finalizado === true` com
// status desatualizado.
function ehConcluido(p: Processo): boolean {
  const statusNorm = String(p.status || "").trim().toLowerCase();
  return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
}

function prazoReferencia(p: Processo): string | undefined {
  return p.prazoFatal || p.finalPrazo || p.prazo;
}

// Visão geral da chefia: quantos processos cada assessor tem, abertos num
// resumo rápido (ativos / no prazo / vencidos / finalizados) — sem precisar
// entrar em cada mesa individual pra ter uma noção de carga de trabalho.
export function SidebarAssessoresResumo({ processos }: SidebarAssessoresResumoProps) {
  const resumos = useMemo(() => {
    const mapa = new Map<string, ResumoAssessor>();

    processos.forEach((p) => {
      const nome = (p.responsavel || "").trim();
      if (!nome) return;

      const atual: ResumoAssessor =
        mapa.get(nome) ?? { nome, total: 0, ativos: 0, finalizados: 0, noPrazo: 0, vencidos: 0 };

      atual.total += 1;
      if (ehConcluido(p)) {
        atual.finalizados += 1;
      } else {
        atual.ativos += 1;
        if (statusPrazo(prazoReferencia(p)) === "overdue") {
          atual.vencidos += 1;
        } else {
          atual.noPrazo += 1;
        }
      }

      mapa.set(nome, atual);
    });

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [processos]);

  if (resumos.length === 0) return null;

  return (
    <div className="px-1 py-2">
      <div className="flex items-center gap-2 px-2 mb-2">
        <Users className="h-3.5 w-3.5 text-sidebar-foreground/60" />
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/60">
          Processos por Assessor
        </h4>
      </div>
      <div className="space-y-1.5">
        {resumos.map((r) => (
          <div key={r.nome} className="rounded-lg bg-sidebar-accent/40 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white truncate">{r.nome}</span>
              <span className="text-[11px] font-black text-white shrink-0">{r.total}</span>
            </div>
            <div className="mt-1 flex items-center gap-x-2 gap-y-0.5 text-[9px] text-sidebar-foreground/70 flex-wrap">
              <span>
                Ativos <b className="text-white">{r.ativos}</b>
              </span>
              <span className="text-emerald-400">
                No prazo <b>{r.noPrazo}</b>
              </span>
              <span className="text-red-400">
                Vencidos <b>{r.vencidos}</b>
              </span>
              <span className="text-sky-400">
                Finalizados <b>{r.finalizados}</b>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
