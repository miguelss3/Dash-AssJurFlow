import { ProcessoCard } from "./ProcessoCard";
import type { Processo, StatusProcesso } from "@/types/processo";

// Definimos as colunas conforme o fluxo real da 12ª RM
const COLUNAS = [
  { id: "MESA CHEFIA", titulo: "Mesa Chefia" },
  { id: "EM ANDAMENTO", titulo: "Em Andamento" }, // Adicionei o "EM" aqui
  { id: "DILIGÊNCIA", titulo: "Diligência" },
  { id: "REVISÃO", titulo: "Revisão Final" }
];

interface KanbanBoardProps {
  processos: Processo[];
  onEdit?: (p: Processo) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, novoStatus: StatusProcesso) => void;
  onAdd?: (status: StatusProcesso) => void;
}

export const KanbanBoard = ({ processos, onEdit, onDelete, onMove, onAdd }: KanbanBoardProps) => {
  return (
    <div className="flex flex-col md:flex-row gap-6 h-full overflow-x-auto pb-4">
      {COLUNAS.map((coluna) => (
        <div key={coluna.id} className="flex-1 min-w-[300px] bg-slate-100/50 rounded-xl p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">
              {coluna.titulo} ({processos.filter(p => p.status === coluna.id).length})
            </h3>
          </div>
          
          <div className="flex flex-col gap-3 h-full overflow-y-auto">
            {processos
              .filter((p) => p.status === coluna.id)
              .map((processo) => (
                <ProcessoCard key={processo.id} processo={processo} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};