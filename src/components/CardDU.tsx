import type { Processo, StatusProcesso } from "@/types/processo";
import { lazy, Suspense, useState, memo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  RotateCcw,
  Clock,
  User,
  Calendar,
  Mail,
  Building2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { addDoc, collection, doc, getDoc, setDoc, setDoc as setMensagemDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { formatarData, diasRestantes } from "@/lib/prazo";
import { getBadgeSituacaoDUContextual } from "@/lib/utils";
import { DetalhesModalDU } from "./DetalhesModalDU";
import { ChatModal } from "./ChatModal";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SiteSettings } from "@/types/siteSettings";

const AcoesDUModalNovo = lazy(() =>
  import("./modals/AcoesDUModalNovo").then((m) => ({ default: m.AcoesDUModalNovo })),
);

interface CardDUProps {
  processo?: Processo;
  p?: Processo;
  ehAdmin?: boolean;
  onEdit?: (p: Processo) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  siteSettings?: SiteSettings;
  showActions?: boolean;
  isDragging?: boolean;
  naoLido?: boolean;
  onMarcarComoLido?: (processoId: string) => void;
  corDestaque?: string;
}

const CardDUComponent = ({
  processo,
  p: pAntigo,
  ehAdmin = false,
  onEdit,
  onDelete,
  onMove,
  onReativarProcesso,
  siteSettings,
  showActions = true,
  isDragging = false,
  naoLido = false,
  onMarcarComoLido,
  corDestaque,
}: CardDUProps) => {
  const p = processo || pAntigo!;
  const { user } = useAuth();
  const marcarComoLido = () => onMarcarComoLido?.(p.id);
  // CORREÇÃO: garantir uso de 'corDestaque' (com 'a')
  const fundoDestaque = /^#([0-9a-fA-F]{6})$/.test(corDestaque || "") ? `${corDestaque}14` : undefined;

  const { attributes, listeners, setNodeRef, transform, isDragging: isBeingDragged } = useDraggable({
    id: p.id,
    disabled: isDragging,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    ...(corDestaque
      ? {
          borderLeftColor: corDestaque,
          borderLeftWidth: "4px",
          backgroundColor: fundoDestaque,
        }
      : {}),
  };

  const situacaoSubsidio = p.pedidoSubsidios?.situacaoFluxo;
  const badgeAcaoChefia = getBadgeSituacaoDUContextual({
    situacaoFluxo: situacaoSubsidio,
    status: p.status,
    responsavel: p.responsavel,
  });

  const [modalAcoesDU, setModalAcoesDU] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [modalChat, setModalChat] = useState(false);
  const [alertExcluir, setAlertExcluir] = useState(false);
  const [modalReativar, setModalReativar] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState("");
  const [novoPrazoFatal, setNovoPrazoFatal] = useState("");
  const [reativando, setReativando] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);

  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@") || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;
  const autorId = user?.uid || "sistema";

  const abrirReativacao = () => {
    setMotivoReabertura("");
    setNovoPrazoFatal(p.prazoFatal || "");
    setModalReativar(true);
  };

  const reativarProcesso = async () => {
    if (!onReativarProcesso) return;
    if (!ehAdmin) {
      if (!motivoReabertura.trim()) {
        toast.error("Informe o motivo da reabertura.");
        return;
      }
      if (!novoPrazoFatal) {
        toast.error("Informe o novo prazo fatal.");
        return;
      }
    }
    try {
      setReativando(true);
      await Promise.resolve(onReativarProcesso(p.id, { motivo: motivoReabertura.trim(), novoPrazoFatal }));
      setModalReativar(false);
      setMotivoReabertura("");
      setNovoPrazoFatal("");
    } finally {
      setReativando(false);
    }
  };

  const registrarHistoricoDesfazer = async (texto: string) => {
    const agoraISO = new Date().toISOString();
    const historicoRef = collection(db, `processos/${p.id}/historico`);
    await addDoc(historicoRef, { autor: autorMilitar, autorId, texto, timestamp: agoraISO });
    const mensagensRef = doc(db, "mensagens", p.id);
    const mensagensSnap = await getDoc(mensagensRef);
    const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
    await setMensagemDoc(mensagensRef, {
      historico: [
        ...historicoExistente,
        { id: crypto.randomUUID(), autor: autorMilitar, autorId, texto, timestamp: agoraISO },
      ],
    });
  };

  const desfazerUltimaAcao = async () => {
    const snapshot = p.ultimaAcaoFluxo?.previousDoc;
    if (!snapshot) {
      toast.error("Não há ação para desfazer neste processo.");
      return;
    }
    try {
      setDesfazendo(true);
      const textoMovimento = `Última ação desfeita por ${autorMilitar}.`;
      const processoRef = doc(db, "processos", p.id);
      await setDoc(processoRef, {
        ...snapshot,
        descricao: textoMovimento,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        ultimaAcaoFluxo: null,
      });
      await registrarHistoricoDesfazer(textoMovimento);
      toast.success("Última ação desfeita com sucesso.");
    } catch (error) {
      console.error("Erro ao desfazer última ação:", error);
      toast.error("Não foi possível desfazer a última ação.");
    } finally {
      setDesfazendo(false);
    }
  };

  const confirmarExclusao = () => {
    if (onDelete) {
      onDelete(p.id);
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
        className={`p-4 shadow-sm border-l-4 transition-all relative group cursor-grab active:cursor-grabbing ${p.isMS ? "bg-red-50 border-red-200 border-l-red-600 hover:shadow-lg" : "bg-white border-l-sky-600 hover:shadow-md"} ${isBeingDragged ? "opacity-30 scale-95" : ""} ${naoLido ? "font-bold" : ""}`}
        onClick={() => {
          if (!isBeingDragged && !isDragging) {
            marcarComoLido();
            setModalDetalhes(true);
          }
        }}
      >
        {p.isMS && (
          <div className="-mx-4 -mt-4 mb-3 px-4 py-2 bg-red-700 text-red-50 border-b border-red-800 rounded-t-md">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
              <AlertCircle className="w-3.5 h-3.5" /> Mandado de Seguranca / Urgente
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">DU</span>
              <span className="text-xs font-mono font-bold text-slate-500">{p.numero}</span>
              {p.isMS && (
                <Badge variant="destructive" className="text-[10px] h-5"><AlertCircle className="w-3 h-3 mr-1" /> MS</Badge>
              )}
              {p.prioridade === "urgente" && !p.isMS && (
                <Badge variant="destructive" className="text-[10px] h-5">URGENTE</Badge>
              )}
              {p.prioridade === "normal" && (
                <Badge variant="outline" className="text-[10px] h-5">Normal</Badge>
              )}
              {p.status === "concluido" ? (
                <Badge variant="outline" className="text-[10px] h-5 border-green-400 text-green-800 bg-green-50">Finalizado</Badge>
              ) : p.processoReaberto ? (
                <Badge variant="outline" className="text-[10px] h-5 border-blue-300 text-blue-700 bg-blue-50">Processo reaberto</Badge>
              ) : badgeAcaoChefia ? (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50">{badgeAcaoChefia}</Badge>
              ) : null}
              {(p.pedidoSubsidios?.reiteracoes || 0) > 0 && (
                <Badge variant="outline" className="text-[10px] h-5 border-indigo-300 text-indigo-700 bg-indigo-50">Reiterações: {p.pedidoSubsidios?.reiteracoes}</Badge>
              )}
            </div>
          </div>

          <h4 className="font-bold text-sm text-slate-800 leading-tight line-clamp-2">{p.tipoAcao}</h4>

          <div className="flex items-center gap-3 text-[11px]">
            {p.prazo && (
              <div className="flex items-center gap-1 text-blue-600">
                <Clock className="w-3 h-3" /> <span className="font-semibold">Interno:</span> <span>{formatarData(p.prazo)}</span>
              </div>
            )}
            {p.prazoFatal && (
              <div className={`flex items-center gap-1 ${diasRestantes(p.prazoFatal) <= 5 ? "text-red-600 font-bold" : "text-orange-600"}`}>
                <AlertCircle className="w-3 h-3" /> <span className="font-semibold">Fatal:</span> <span>{formatarData(p.prazoFatal)}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <p className="flex items-center gap-1"><User className="w-3 h-3" /> <strong>Parte:</strong> {p.cliente}</p>
            {p.dataEntrada && (
              <p className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> <strong>Entrada:</strong> {formatarData(p.dataEntrada)}</p>
            )}
            <div className="flex items-center gap-3">
              {p.secaoDU && <p className="flex items-center gap-1"><Building2 className="w-3 h-3" /> <strong>Seção:</strong> {p.secaoDU}</p>}
              {p.origemDU && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> <strong>Origem:</strong> {p.origemDU}</p>}
            </div>
            {p.responsavel && (
              <p className="flex items-center gap-1 text-sky-700 font-semibold"><User className="w-3 h-3" /> Assessor: {p.responsavel}</p>
            )}
          </div>

          {showActions && (
            <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-sky-300 text-sky-700 hover:bg-sky-50 text-[11px] h-9 disabled:opacity-60 whitespace-nowrap"
                  onClick={(e) => { e.stopPropagation(); marcarComoLido(); setModalAcoesDU(true); }}
                >
                  <Send className="w-3 h-3 mr-1 shrink-0" /> Ação
                </Button>
                {onEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 text-xs h-9"
                    onClick={(e) => { e.stopPropagation(); marcarComoLido(); onEdit(p); }}
                  >
                    <FileEdit className="w-3 h-3 mr-1" /> Editar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-300 text-slate-600 hover:bg-slate-50 text-xs h-9"
                  onClick={(e) => { e.stopPropagation(); marcarComoLido(); setModalChat(true); }}
                >
                  <MessageSquare className="w-3 h-3 mr-1" /> Chat
                </Button>
              </div>

              <div className={`grid gap-2 ${p.status === "concluido" ? "grid-cols-3" : "grid-cols-2"}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs h-9"
                  disabled={!p.ultimaAcaoFluxo?.previousDoc || desfazendo}
                  onClick={(e) => { e.stopPropagation(); marcarComoLido(); void desfazerUltimaAcao(); }}
                >
                  <RotateCcw className="w-3 h-3 mr-1" /> {desfazendo ? "Desfazendo..." : "Desfazer"}
                </Button>
                {p.status === "concluido" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-300 text-blue-700 hover:bg-blue-50 text-xs h-9"
                    onClick={(e) => { e.stopPropagation(); marcarComoLido(); abrirReativacao(); }}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Reabrir
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50 text-xs h-9 font-semibold"
                    onClick={(e) => { e.stopPropagation(); marcarComoLido(); setAlertExcluir(true); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                )}
              </div>
            </div>
          )}

          {p.descricao && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">Último Movimento</div>
              <div className="text-xs text-slate-700 leading-snug line-clamp-2">{p.descricao}</div>
            </div>
          )}
        </div>
      </Card>

      <Suspense fallback={null}>
        {modalAcoesDU && <AcoesDUModalNovo open={modalAcoesDU} onOpenChange={setModalAcoesDU} processoId={p.id} numeroProcesso={p.numero} onSuccess={() => {}} />}
      </Suspense>

      {modalDetalhes && <DetalhesModalDU open={modalDetalhes} onOpenChange={setModalDetalhes} processo={p} />}
      {modalChat && <ChatModal open={modalChat} onOpenChange={setModalChat} processo={p} />}

      {modalReativar && (
        <Dialog open={modalReativar} onOpenChange={setModalReativar}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Reabrir Processo {p.numero}</DialogTitle>
              <DialogDescription>
                {ehAdmin ? "Ao reabrir, o processo volta ao fluxo ativo." : "Informe o motivo da reabertura e defina o novo prazo fatal."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`motivo-${p.id}`}>Motivo da reabertura {!ehAdmin ? "*" : ""}</Label>
                <Textarea id={`motivo-${p.id}`} value={motivoReabertura} onChange={(e) => setMotivoReabertura(e.target.value)} placeholder="Descreva o motivo" rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`prazo-fatal-${p.id}`}>Novo prazo fatal {!ehAdmin ? "*" : ""}</Label>
                <Input id={`prazo-fatal-${p.id}`} type="date" value={novoPrazoFatal} onChange={(e) => setNovoPrazoFatal(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalReativar(false)} disabled={reativando}>Cancelar</Button>
              <Button type="button" onClick={reativarProcesso} disabled={reativando || !onReativarProcesso}>
                {reativando ? "Reabrindo..." : "Confirmar Reabertura"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {alertExcluir && (
        <AlertDialog open={alertExcluir} onOpenChange={setAlertExcluir}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" /> Excluir Processo?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p className="font-semibold text-slate-900">Você está prestes a excluir permanentemente:</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <p><strong>Número:</strong> {p.numero}</p>
                  <p><strong>Tipo:</strong> {p.tipoAcao}</p>
                  <p><strong>Parte:</strong> {p.cliente}</p>
                  <p><strong>Responsável:</strong> {p.responsavel}</p>
                </div>
                <p className="text-red-600 font-semibold">Esta ação não pode ser desfeita!</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.stopPropagation(); confirmarExclusao(); }} className="bg-red-600 hover:bg-red-700 text-white">Sim, Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};

export const CardDU = memo(CardDUComponent, (prevProps, nextProps) => {
  if (prevProps.isDragging !== nextProps.isDragging) return false;
  if (prevProps.naoLido !== nextProps.naoLido) return false;

  const pPrev = prevProps.processo || prevProps.p;
  const pNext = nextProps.processo || nextProps.p;

  if (pPrev === pNext) return true;
  if (!pPrev || !pNext) return pPrev === pNext;

  const psPrev = pPrev.pedidoSubsidios;
  const psNext = nextProps.processo?.pedidoSubsidios ?? nextProps.p?.pedidoSubsidios;

  // CORREÇÃO: Força o card a pintar a cor assim que ela carregar
  return (
    pPrev.id === pNext.id
    && pPrev.status === pNext.status
    && pPrev.responsavel === pNext.responsavel
    && pPrev.descricao === pNext.descricao
    && pPrev.prazoFatal === pNext.prazoFatal
    && pPrev.finalPrazo === pNext.finalPrazo
    && pPrev.prazo === pNext.prazo
    && pPrev.processoReaberto === pNext.processoReaberto
    && pPrev.isMS === pNext.isMS
    && pPrev.atualizadoEm === pNext.atualizadoEm
    && prevProps.corDestaque === nextProps.corDestaque // CORREÇÃO: Força o card a pintar a cor assim que ela carregar
    && (psPrev?.situacaoFluxo ?? null) === (psNext?.situacaoFluxo ?? null)
    && (psPrev?.reiteracoes ?? null) === (psNext?.reiteracoes ?? null)
  );
});
