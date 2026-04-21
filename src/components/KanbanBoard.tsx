import { useProcessos } from "@/hooks/useProcessos";
import { ProcessoCard } from "./ProcessoCard";

// Definimos as colunas conforme o fluxo real da 12ª RM
const COLUNAS = [
  { id: "MESA CHEFIA", titulo: "Mesa Chefia" },
  { id: "EM ANDAMENTO", titulo: "Em Andamento" }, // Adicionei o "EM" aqui
  { id: "DILIGÊNCIA", titulo: "Diligência" },
  { id: "REVISÃO", titulo: "Revisão Final" }
];

export const KanbanBoard = () => {
  const { processos, carregando } = useProcessos();

  if (carregando) return <div className="p-8 text-center text-slate-500">A carregar processos da 12ª RM...</div>;

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