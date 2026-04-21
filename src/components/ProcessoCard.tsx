import { Processo } from "@/hooks/useProcessos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Clipboard, Edit, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface ProcessoCardProps {
  processo: Processo;
}

export const ProcessoCard = ({ processo }: ProcessoCardProps) => {
  
  // Função para a Clipboard API (SPED)
  const copiarSPED = () => {
    const texto = `NUP: ${processo.nup}\nInteressado: ${processo.interessado}\nAssunto: ${processo.assunto || "N/A"}`;
    navigator.clipboard.writeText(texto);
    toast.success("Dados copiados para o SPED!");
  };

  return (
    <Card className="p-4 bg-white shadow-sm border-l-4 border-l-sky-600 hover:shadow-md transition-shadow relative">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
            {processo.tipo || "PROCESSO"}
          </span>
          
          {/* O Menu "⚡ Ação" que limpa a interface mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menu</span>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={copiarSPED} className="cursor-pointer">
                <Clipboard className="mr-2 h-4 w-4 text-sky-600" /> 📋 Copiar SPED
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer">
                <MessageSquare className="mr-2 h-4 w-4" /> Chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600 cursor-pointer">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h4 className="font-bold text-sm text-slate-800 leading-tight">
          {processo.nup}
        </h4>
        
        <p className="text-xs text-slate-600 font-medium">
          {processo.interessado}
        </p>

        {processo.prazoFatal && (
          <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Prazo Fatal</span>
            <span className="text-[10px] font-bold text-red-600">{processo.prazoFatal}</span>
          </div>
        )}
      </div>
    </Card>
  );
};