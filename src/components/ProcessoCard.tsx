import type { Processo, StatusProcesso } from "@/types/processo";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileEdit, 
  MessageSquare, 
  Trash2, 
  Send, 
  CheckCircle,
  Clock,
  FileText,
  User
} from "lucide-react";
import { toast } from "sonner";
import { formatarData, diasRestantes } from "@/lib/prazo";
import { AcoesDUModal } from "./modals/AcoesDUModal";
import { AcoesPAModal } from "./modals/AcoesPAModal";

interface ProcessoCardProps {
  processo: Processo;
  onEdit?: (p: Processo) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, status: StatusProcesso) => void;
  showActions?: boolean;
}

export const ProcessoCard = ({ processo, onEdit, onDelete, onMove, showActions = true }: ProcessoCardProps) => {
  const p = processo;
  const setor = p.setor || p.tipo;
  const isDU = setor === "DU";
  const isPA = setor === "PA";
  
  const [modalAcoesDU, setModalAcoesDU] = useState(false);
  const [modalAcoesPA, setModalAcoesPA] = useState(false);
  
  // Função para abrir o chat do processo
  const abrirChat = () => {
    toast.info("Chat em desenvolvimento");
    // TODO: Implementar modal de chat
  };
  
  // Função para finalizar processo
  const finalizarProcesso = () => {
    if (window.confirm(`Deseja finalizar o processo ${p.numero}?`)) {
      if (onMove) {
        onMove(p.id, "concluido");
        toast.success("Processo finalizado!");
      }
    }
  };
  
  // Função de ações DU
  const abrirAcoesDU = () => {
    setModalAcoesDU(true);
  };
  
  // Função de ações PA
  const abrirAcoesPA = () => {
    setModalAcoesPA(true);
  };

  return (
    <>
      <Card className="p-4 bg-white shadow-sm border-l-4 border-l-sky-600 hover:shadow-md transition-shadow relative group">
        <div className="flex flex-col gap-3">
          {/* Header com badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              isDU ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}>
              {setor}
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">{p.numero}</span>
          </div>

          {/* Título - Assunto */}
          <h4 className="font-bold text-sm text-slate-800 leading-tight line-clamp-2">
            {p.tipoAcao}
          </h4>
          
          {/* Informações principais */}
          <div className="text-xs text-slate-600 space-y-1">
            <p className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <strong>Parte:</strong> {p.cliente}
            </p>
            {p.responsavel && (
              <p className="flex items-center gap-1 text-sky-700 font-semibold">
                <User className="w-3 h-3" />
                Assessor: {p.responsavel}
              </p>
            )}
          </div>

          {/* Prazo Fatal */}
          {p.prazoFatal && (
            <div className={`mt-2 pt-2 border-t flex items-center justify-between ${
              diasRestantes(p.prazoFatal) <= 5 ? 'border-red-200' : 'border-slate-100'
            }`}>
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Prazo Fatal
              </span>
              <span className={`text-[10px] font-bold ${
                diasRestantes(p.prazoFatal) <= 5 ? 'text-red-600 animate-pulse' : 'text-slate-600'
              }`}>
                {formatarData(p.prazoFatal)}
                {diasRestantes(p.prazoFatal) > 0 && (
                  <span className="ml-1">({diasRestantes(p.prazoFatal)}d)</span>
                )}
              </span>
            </div>
          )}

          {/* Botões de Ação */}
          {showActions && (
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
              {/* Botão Ação (DU ou PA) */}
              {isDU ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-sky-300 text-sky-700 hover:bg-sky-50 text-xs h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirAcoesDU();
                  }}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Ação
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirAcoesPA();
                  }}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Ação
                </Button>
              )}

              {/* Botão Editar */}
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(p);
                  }}
                >
                  <FileEdit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              )}

              {/* Botão Chat */}
              <Button
                size="sm"
                variant="outline"
                className="border-slate-300 text-slate-600 hover:bg-slate-50 text-xs h-9"
                onClick={(e) => {
                  e.stopPropagation();
                  abrirChat();
                }}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Chat
              </Button>

              {/* Botão Finalizar ou Excluir */}
              {p.status !== "concluido" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    finalizarProcesso();
                  }}
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Finalizar
                </Button>
              ) : onDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Excluir processo ${p.numero}?`)) {
                      onDelete(p.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Excluir
                </Button>
              )}
            </div>
          )}

          {/* Última movimentação */}
          {p.descricao && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
                Último Movimento
              </div>
              <div className="text-xs text-slate-700 leading-snug line-clamp-2">
                {p.descricao}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Modais de Ações */}
      <AcoesDUModal
        open={modalAcoesDU}
        onOpenChange={setModalAcoesDU}
        processoId={p.id}
        numeroProcesso={p.numero}
      />

      <AcoesPAModal
        open={modalAcoesPA}
        onOpenChange={setModalAcoesPA}
        processoId={p.id}
        numeroProcesso={p.numero}
      />
    </>
  );
};