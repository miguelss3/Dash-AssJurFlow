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
  RotateCcw,
  Clock,
  FileText,
  User,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { addDoc, collection, doc, getDoc, setDoc, setDoc as setMensagemDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { calcularFaixasProrrogacaoPA, formatarData, diasRestantes } from "@/lib/prazo";
import { getBadgeSituacaoPA } from "@/lib/utils";
import { DetalhesModalPA } from "./DetalhesModalPA";
import { ChatModal } from "./ChatModal";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SiteSettings } from "@/types/siteSettings";

const AcoesPAModalV4 = lazy(() =>
  import("./modals/AcoesPAModalV4").then((m) => ({ default: m.AcoesPAModalV4 })),
);
const AcoesConselhoModalV4 = lazy(() =>
  import("./modals/AcoesConselhoModalV4").then((m) => ({ default: m.AcoesConselhoModalV4 })),
);
const AcoesIPModalV4 = lazy(() =>
  import("./modals/AcoesIPModalV4").then((m) => ({ default: m.AcoesIPModalV4 })),
);

// V5.1 — Router de modal de ações por tipoPA.
type ModalAcaoPA = "PA" | "CONSELHO" | "IP";
const resolverModalPA = (tipoPA?: string): ModalAcaoPA => {
  const t = (tipoPA || "").trim().toLowerCase();
  if (
    t === "investigação preliminar"
    || t === "investigacao preliminar"
    || t === "outros"
  ) return "IP";
  if (t === "conselho de disciplina" || t === "conselho de justificação" || t === "conselho de justificacao") return "CONSELHO";
  return "PA";
};

interface CardPAProps {
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

const CardPAComponent = ({
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
}: CardPAProps) => {
  const p = processo || pAntigo!;
  const { user } = useAuth();
  const marcarComoLido = () => onMarcarComoLido?.(p.id);
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

  const prorrogacoesPA = calcularFaixasProrrogacaoPA({
    tipoPA: p.tipoPA,
    dataInicioPrazo: p.dataInicioPrazo,
    dataAssinatura: p.dataAssinatura,
    prorrogacoes: p.prorrogacoes,
  }).map((faixa, index) => ({
    ...faixa,
    doc: p.prorrogacoes?.[index]?.doc || "Documento não informado",
    por: p.prorrogacoes?.[index]?.por,
    em: p.prorrogacoes?.[index]?.em,
  }));

  const badgeSituacaoPA = getBadgeSituacaoPA({
    situacaoFluxoPA: p.situacaoFluxoPA,
    situacaoFluxoConselho: p.situacaoFluxoConselho,
    situacaoFluxoIP: p.situacaoFluxoIP,
    situacaoFluxoLegado: p.situacaoFluxo,
    status: p.faseAtual || p.status,
  });

  const normalizarSituacao = (valor?: string) =>
    String(valor || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const sitPA = normalizarSituacao(p.situacaoFluxoPA);
  const sitIP = normalizarSituacao(p.situacaoFluxoIP);
  const badgeExibicaoPA =
    sitIP === "MESA_ASSESSOR"
    || sitPA === "FAZENDO_PORTARIA"
    || sitPA === "FAZENDO_SOLUCAO"
    || sitPA === "ASSINANDO_SOLUCAO"
      ? "Mesa do Assessor"
      : badgeSituacaoPA;

  const [modalAcoesPA, setModalAcoesPA] = useState(false);
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
        className={`p-4 shadow-sm border-l-4 transition-all relative group cursor-grab active:cursor-grabbing bg-white border-l-purple-600 hover:shadow-md ${isBeingDragged ? "opacity-30 scale-95" : ""} ${naoLido ? "font-bold" : ""}`}
        onClick={() => {
          if (!isBeingDragged && !isDragging) {
            marcarComoLido();
            setModalDetalhes(true);
          }
        }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">PA</span>
              <span className="text-xs font-mono font-bold text-slate-500">{p.numero}</span>
              {p.tipoPA && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">{p.tipoPA}</span>
              )}
              {p.status === "concluido" ? (
                <Badge variant="outline" className="text-[10px] h-5 border-green-400 text-green-800 bg-green-50">Finalizado</Badge>
              ) : p.processoReaberto ? (
                <Badge variant="outline" className="text-[10px] h-5 border-blue-300 text-blue-700 bg-blue-50">Processo reaberto</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-800 bg-amber-50">{badgeExibicaoPA}</Badge>
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
                <AlertCircle className="w-3 h-3" /> <span className="font-semibold">Final:</span> <span>{formatarData(p.prazoFatal)}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-600 space-y-1">
            <p className="flex items-center gap-1"><User className="w-3 h-3" /> <strong>Parte:</strong> {p.cliente}</p>
            {p.dataEntrada && (
              <p className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> <strong>Entrada:</strong> {formatarData(p.dataEntrada)}</p>
            )}
            {p.dataInicioPrazo && (
              <p className="flex items-center gap-1 text-purple-700 font-medium"><Calendar className="w-3 h-3" /> <strong>Início do Prazo:</strong> {formatarData(p.dataInicioPrazo)}</p>
            )}
            {p.responsavel && (
              <p className="flex items-center gap-1 text-purple-700 font-semibold"><User className="w-3 h-3" /> Assessor: {p.responsavel}</p>
            )}
            {p.encarregado && (
              <p className="flex items-center gap-1 text-purple-700 font-medium"><User className="w-3 h-3" /> <strong>Encarregado:</strong> {p.encarregado}</p>
            )}
          </div>

          {prorrogacoesPA.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-amber-700 mb-1">Prorrogações Registradas ({prorrogacoesPA.length})</div>
              <div className="space-y-1.5">
                {prorrogacoesPA.map((item, index) => (
                  <div key={`${item.doc || "sem-doc"}-${item.em || index}`} className="text-[11px] text-amber-900 bg-white/80 border border-amber-100 rounded px-2 py-1">
                    <div className="font-semibold">{item.doc || "Documento não informado"}</div>
                    <div className="text-amber-800">Início: {formatarData(item.inicio)} | Fim: {formatarData(item.fim)} | +{item.dias ?? "?"} dias {item.por ? ` | Por: ${item.por}` : ""}</div>
                    {item.em && <div className="text-[10px] text-amber-700 mt-0.5">Registro: {formatarData(item.em)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showActions && (
            <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs h-9"
                  onClick={(e) => { e.stopPropagation(); marcarComoLido(); setModalAcoesPA(true); }}
                >
                  <FileText className="w-3 h-3 mr-1" /> Ação
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
        {modalAcoesPA && (() => {
          const variante = resolverModalPA(p.tipoPA);
          if (variante === "IP") {
            return <AcoesIPModalV4 open={modalAcoesPA} onOpenChange={setModalAcoesPA} processoId={p.id} numeroProcesso={p.numero} siteSettings={siteSettings} onSuccess={() => {}} />;
          }
          if (variante === "CONSELHO") {
            return <AcoesConselhoModalV4 open={modalAcoesPA} onOpenChange={setModalAcoesPA} processoId={p.id} numeroProcesso={p.numero} siteSettings={siteSettings} onSuccess={() => {}} />;
          }
          return <AcoesPAModalV4 open={modalAcoesPA} onOpenChange={setModalAcoesPA} processoId={p.id} numeroProcesso={p.numero} siteSettings={siteSettings} onSuccess={() => {}} />;
        })()}
      </Suspense>

      {modalDetalhes && <DetalhesModalPA open={modalDetalhes} onOpenChange={setModalDetalhes} processo={p} />}
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

export const CardPA = memo(CardPAComponent, (prevProps, nextProps) => {
  if (prevProps.isDragging !== nextProps.isDragging) return false;
  if (prevProps.naoLido !== nextProps.naoLido) return false;

  const pPrev = prevProps.processo || prevProps.p;
  const pNext = nextProps.processo || nextProps.p;

  if (pPrev === pNext) return true;
  if (!pPrev || !pNext) return pPrev === pNext;

  return (
    pPrev.id === pNext.id
    && pPrev.status === pNext.status
    && pPrev.responsavel === pNext.responsavel
    && pPrev.descricao === pNext.descricao
    && pPrev.prazoFatal === pNext.prazoFatal
    && pPrev.finalPrazo === pNext.finalPrazo
    && pPrev.prazo === pNext.prazo
    && pPrev.processoReaberto === pNext.processoReaberto
    && pPrev.atualizadoEm === pNext.atualizadoEm
    && pPrev.tipoPA === pNext.tipoPA
    && pPrev.encarregado === pNext.encarregado
  );
});
