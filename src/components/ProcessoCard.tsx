import type { Processo, StatusProcesso } from "@/types/processo";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  FileEdit, 
  MessageSquare, 
  Trash2, 
  Send, 
  CheckCircle,
  Copy,
  Clock,
  FileText,
  User,
  Calendar,
  Mail,
  Building2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { formatarData, diasRestantes } from "@/lib/prazo";
import { AcoesDUModalNovo } from "./modals/AcoesDUModalNovo";
import { AcoesPAModalNovo } from "./modals/AcoesPAModalNovo";
import { DetalhesProcessoModal } from "./DetalhesProcessoModal";
import { ChatModal } from "./ChatModal";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface ProcessoCardProps {
  processo?: Processo;
  p?: Processo; // Compatibilidade com código antigo
  ehAdmin?: boolean;
  onEdit?: (p: Processo) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, status: StatusProcesso) => void;
  onClone?: (id: string) => void;
  showActions?: boolean;
  isDragging?: boolean; // Flag para quando está sendo arrastado no overlay
}

export const ProcessoCard = ({ processo, p: pAntigo, ehAdmin = false, onEdit, onDelete, onMove, onClone, showActions = true, isDragging = false }: ProcessoCardProps) => {
  const p = processo || pAntigo!;
  
  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: p.id,
    disabled: isDragging, // Desabilita drag no overlay
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };
  const setor = p.setor || p.tipo;
  const isDU = setor === "DU";
  const isPA = setor === "PA";
  const situacaoSubsidio = p.pedidoSubsidios?.situacaoFluxo;
  const statusNormalizado = (p.status || "").toString().trim().toLowerCase();
  const bloqueioPorStatus = statusNormalizado.includes("aguardando assinatura") || statusNormalizado.includes("aguardando chem");
  const bloqueioPorFluxo = ["aguardando_assinatura_secao", "aguardando_aprovacao_externa", "enviado_admin"].includes(situacaoSubsidio || "");
  const acaoDUBloqueada = !ehAdmin && isDU && (bloqueioPorFluxo || bloqueioPorStatus);
  const badgeAcaoChefia = (() => {
    if (situacaoSubsidio === "aguardando_assinatura_secao") return "Assinatura do Chefe de Seção";
    if (situacaoSubsidio === "aguardando_aprovacao_externa") return "Envio para aprovação do CHEM";
    if (situacaoSubsidio === "aprovado_externo_enviado_chem" || statusNormalizado.includes("aguardando chem")) return "Saída pelo CHEM";
    return null;
  })();
  
  const [modalAcoesDU, setModalAcoesDU] = useState(false);
  const [modalAcoesPA, setModalAcoesPA] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalChat, setModalChat] = useState(false);
  const [alertExcluir, setAlertExcluir] = useState(false);
  
  // Função para abrir o chat do processo
  const abrirChat = () => {
    setModalChat(true);
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
  
  // Função para excluir processo
  const confirmarExclusao = () => {
    if (onDelete) {
      onDelete(p.id);
      toast.success(`Processo ${p.numero} excluído com sucesso!`);
      setAlertExcluir(false);
    }
  };

  return (
    <>
      <Card 
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`p-4 bg-white shadow-sm border-l-4 border-l-sky-600 hover:shadow-md transition-all relative group cursor-grab active:cursor-grabbing ${
          isBeingDragged ? "opacity-30 scale-95" : ""
        }`}
        onClick={(e) => {
          // Só abre detalhes se não estiver arrastando
          if (!isBeingDragged && !isDragging) {
            setModalDetalhes(true);
          }
        }}
      >
        <div className="flex flex-col gap-3">
          {/* Header com badges */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                isDU ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}>
                {setor}
              </span>
              <span className="text-xs font-mono font-bold text-slate-500">{p.numero}</span>
              
              {/* Badge Tipo PA (IPM, Sindicância, Conselho) */}
              {isPA && p.tipoPA && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                  {p.tipoPA}
                </span>
              )}
              
              {/* Badge Prioridade/MS */}
              {p.isMS && (
                <Badge variant="destructive" className="text-[10px] h-5">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  MS
                </Badge>
              )}
              {p.prioridade === "urgente" && !p.isMS && (
                <Badge variant="destructive" className="text-[10px] h-5">URGENTE</Badge>
              )}
              {p.prioridade === "normal" && (
                <Badge variant="outline" className="text-[10px] h-5">Normal</Badge>
              )}
              {badgeAcaoChefia && (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50">
                  {badgeAcaoChefia}
                </Badge>
              )}
              {(p.pedidoSubsidios?.reiteracoes || 0) > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 border-indigo-300 text-indigo-700 bg-indigo-50">
                  Reiterações: {p.pedidoSubsidios?.reiteracoes}
                </Badge>
              )}
            </div>
          </div>

          {/* Título - Assunto */}
          <h4 className="font-bold text-sm text-slate-800 leading-tight line-clamp-2">
            {p.tipoAcao}
          </h4>
          
          {/* Badges de Prazos */}
          <div className="flex items-center gap-3 text-[11px]">
            {p.prazo && (
              <div className="flex items-center gap-1 text-blue-600">
                <Clock className="w-3 h-3" />
                <span className="font-semibold">Interno:</span>
                <span>{formatarData(p.prazo)}</span>
              </div>
            )}
            {p.prazoFatal && (
              <div className={`flex items-center gap-1 ${
                diasRestantes(p.prazoFatal) <= 5 ? 'text-red-600 font-bold' : 'text-orange-600'
              }`}>
                <AlertCircle className="w-3 h-3" />
                <span className="font-semibold">Fatal:</span>
                <span>{formatarData(p.prazoFatal)}</span>
              </div>
            )}
          </div>
          
          {/* Informações principais */}
          <div className="text-xs text-slate-600 space-y-1">
            <p className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <strong>Parte:</strong> {p.cliente}
            </p>
            
            {/* Entrada */}
            {p.dataEntrada && (
              <p className="flex items-center gap-1 text-slate-500">
                <Calendar className="w-3 h-3" />
                <strong>Entrada:</strong> {formatarData(p.dataEntrada)}
              </p>
            )}
            
            {/* DU - Seção e Origem */}
            {isDU && (
              <div className="flex items-center gap-3">
                {p.secaoDU && (
                  <p className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    <strong>Seção:</strong> {p.secaoDU}
                  </p>
                )}
                {p.origemDU && (
                  <p className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    <strong>Origem:</strong> {p.origemDU}
                  </p>
                )}
              </div>
            )}
            
            {/* Responsável/Assessor */}
            {p.responsavel && (
              <p className="flex items-center gap-1 text-sky-700 font-semibold">
                <User className="w-3 h-3" />
                {isDU ? 'Assessor:' : 'Encarregado:'} {p.responsavel}
              </p>
            )}
          </div>



          {/* Botões de Ação */}
          {showActions && (
            <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
              {/* Linha 1: Ação, Editar, Chat */}
              <div className="grid grid-cols-3 gap-2">
                {/* Botão Ação (DU ou PA) */}
                {isDU ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-sky-300 text-sky-700 hover:bg-sky-50 text-[11px] h-9 disabled:opacity-60 whitespace-nowrap"
                    disabled={acaoDUBloqueada}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (acaoDUBloqueada) return;
                      abrirAcoesDU();
                    }}
                    title={acaoDUBloqueada ? "Aguardando trâmite do pedido de subsídios" : "Ações do processo"}
                  >
                    <Send className="w-3 h-3 mr-1 shrink-0" />
                    {acaoDUBloqueada ? "Aguard." : "Ação"}
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
              </div>

              {/* Linha 2: Clonar */}
              {onClone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-cyan-300 text-cyan-700 hover:bg-cyan-50 text-xs h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClone(p.id);
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Clonar
                </Button>
              )}
              
              {/* Linha 3: Finalizar (se não concluído) + Excluir */}
              <div className={`grid gap-2 ${p.status !== "concluido" ? "grid-cols-2" : "grid-cols-1"}`}>
                {/* Botão Finalizar (apenas se não estiver concluído) */}
                {p.status !== "concluido" && (
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
                )}
                
                {/* Botão Excluir (SEMPRE DISPONÍVEL) */}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-9 font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAlertExcluir(true);
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                )}
              </div>
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
      <AcoesDUModalNovo
        open={modalAcoesDU}
        onOpenChange={setModalAcoesDU}
        processoId={p.id}
        numeroProcesso={p.numero}
        onSuccess={() => {}}
      />

      <AcoesPAModalNovo
        open={modalAcoesPA}
        onOpenChange={setModalAcoesPA}
        processoId={p.id}
        numeroProcesso={p.numero}
        onSuccess={() => {}}
      />

      {/* Modal de Detalhes */}
      <DetalhesProcessoModal
        open={modalDetalhes}
        onOpenChange={setModalDetalhes}
        processo={p}
      />

      {/* Modal de Chat */}
      <ChatModal
        open={modalChat}
        onOpenChange={setModalChat}
        processo={p}
      />
      
      {/* AlertDialog de Confirmação de Exclusão */}
      <AlertDialog open={alertExcluir} onOpenChange={setAlertExcluir}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Excluir Processo?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p className="font-semibold text-slate-900">Você está prestes a excluir permanentemente:</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                <p><strong>Número:</strong> {p.numero}</p>
                <p><strong>Tipo:</strong> {p.tipoAcao}</p>
                <p><strong>Parte:</strong> {p.cliente}</p>
                <p><strong>Responsável:</strong> {p.responsavel}</p>
              </div>
              <p className="text-red-600 font-semibold">⚠️ Esta ação não pode ser desfeita!</p>
              <p className="text-sm text-slate-600">O processo será removido permanentemente do banco de dados.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                confirmarExclusao();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};