import type { Processo, StatusProcesso } from "@/types/processo";
import { MesaTrabalho } from "@/components/MesaTrabalho";

interface KanbanBoardProps {
  processos: Processo[];
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onAdd?: () => void;
}

export function KanbanBoard({ processos, onEdit, onDelete, onMove }: KanbanBoardProps) {
  return (
    <MesaTrabalho
      processos={processos}
      filtroTipo="todos"
      onEdit={onEdit}
      onDelete={onDelete}
      onMove={onMove}
    />
  );
}
