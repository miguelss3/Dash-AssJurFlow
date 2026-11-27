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
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { addDoc, collection, doc, getDoc, setDoc, setDoc as setMensagemDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { calcularFaixasProrrogacaoPA, calcularPrazoAssinaturaSolucao, formatarData, diasRestantes, nivelUrgenciaPA, foiConcluidoForaDoPrazo } from "@/lib/prazo";
import { registrarErro } from "@/lib/errorLog";
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
    || t === "requerimento administrativo"
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
  /**
   * V9.15 — Quando `true`, o card está sendo renderizado dentro da Mesa do
   * Assessor (vistaAssessor). Os atalhos "Enviar Solução para Assinatura" e
   * "Devolver para o Encarregado" só fazem sentido ali — nas colunas de tipo
   * (Sindicância/IPM/Conselho), o mesmo processo em FAZENDO_SOLUCAO também
   * aparece em "No Prazo"/"Em Atraso" (V9.11), mas ali é só leitura.
   */
  dentroDaMesaDoAssessor?: boolean;
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
  dentroDaMesaDoAssessor = false,
}: CardPAProps) => {
  const p = processo || pAntigo!;
  const { user } = useAuth();
  const marcarComoLido = () => onMarcarComoLido?.(p.id);
  const fundoDestaque = /^#([0-9a-fA-F]{6})$/.test(corDestaque || "") ? `${corDestaque}33` : undefined;

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

  const nivelPA = nivelUrgenciaPA(p.prazoFatal || p.finalPrazo, p.tipoPA, siteSettings);

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
  // V9.16 — "Fazendo Solução/Parecer" ganhou aba própria na Mesa do Assessor
  // ("Solução/Parecer"), separada de "Mesa do Assessor" (onde ficam só os
  // processos recém-distribuídos, sem nenhuma ação ainda) — a tag no card
  // agora reflete exatamente em qual aba ele está.
  // V9.20 — ASSINANDO_SOLUCAO saiu da Mesa do Assessor (V9.13: ganhou aba
  // própria "Solução para Assinatura" na coluna de tipo), então não deve
  // mais exibir a tag "Mesa do Assessor" — cai no badgeSituacaoPA padrão,
  // que já retorna "Aguardando Assinatura da Solucao" para esse estado.
  const badgeExibicaoPA =
    sitPA === "FAZENDO_SOLUCAO"
      ? "Fazendo Solução/Parecer"
      : sitIP === "MESA_ASSESSOR"
        || sitPA === "FAZENDO_PORTARIA"
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
  const [enviandoSolucao, setEnviandoSolucao] = useState(false);
  const [modalDevolverEncarregado, setModalDevolverEncarregado] = useState(false);
  const [exposicaoMotivos, setExposicaoMotivos] = useState("");
  const [novoPrazoInterno, setNovoPrazoInterno] = useState("");
  const [devolvendoEncarregado, setDevolvendoEncarregado] = useState(false);

  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;
  const autorId = user?.uid || "sistema";

  const abrirReativacao = () => {
    setMotivoReabertura("");
    // Começa vazio de propósito — o prazo fatal antigo já venceu (é por isso
    // que o processo está sendo reaberto), então não faz sentido pré-marcar
    // essa data como se já estivesse certa.
    setNovoPrazoFatal("");
    setModalReativar(true);
  };

  const reativarProcesso = async () => {
    if (!onReativarProcesso) return;
    if (!ehAdmin && !motivoReabertura.trim()) {
      toast.error("Informe o motivo da reabertura.");
      return;
    }
    // Novo prazo fatal é obrigatório pra qualquer um que reabrir — o antigo
    // já está vencido, então reabrir sem definir um novo deixaria o processo
    // "atrasado" desde o primeiro segundo.
    if (!novoPrazoFatal) {
      toast.error("Informe o novo prazo fatal.");
      return;
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
      registrarErro("CardPA.desfazerUltimaAcao", error, { processoId: p.id });
      toast.error("Não foi possível desfazer a última ação.");
    } finally {
      setDesfazendo(false);
    }
  };

  // V9.13 — Atalho direto no card: evita abrir o modal "Ação" só para
  // despachar a solução pronta para assinatura da Chefia/Cmt. Mesma
  // transição que o botão "Despachar Solução para Chefia" do AcoesPAModalV4.
  const enviarSolucaoParaAssinatura = async () => {
    try {
      setEnviandoSolucao(true);
      const processoRef = doc(db, "processos", p.id);
      const textoMovimento = `Solução despachada para assinatura da Chefia/Cmt por ${autorMilitar}.`;
      await updateDoc(processoRef, {
        situacaoFluxoPA: "ASSINANDO_SOLUCAO",
        // V9.22 — marca o início do prazo de 5 dias do Cmt para assinar.
        dataDespachoAssinatura: new Date().toISOString().slice(0, 10),
        // V9.15 — sem isto, "Último Movimento" no card continua mostrando o
        // texto da transição anterior (ex.: "Sindicância recebida em..."),
        // dando a impressão de que a solução ainda não foi enviada.
        descricao: textoMovimento,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });
      await addDoc(collection(db, `processos/${p.id}/historico`), {
        autor: autorMilitar,
        autorId,
        texto: textoMovimento,
        timestamp: new Date().toISOString(),
      });
      toast.success("Solução enviada para assinatura.");
    } catch (error) {
      console.error("Erro ao enviar solução para assinatura:", error);
      registrarErro("CardPA.enviarSolucaoParaAssinatura", error, { processoId: p.id });
      toast.error("Não foi possível enviar a solução para assinatura.");
    } finally {
      setEnviandoSolucao(false);
    }
  };

  const abrirDevolverEncarregado = () => {
    setExposicaoMotivos("");
    setNovoPrazoInterno("");
    setModalDevolverEncarregado(true);
  };

  // V9.14 — Devolve o processo ao Encarregado (volta para COM_ENCARREGADO)
  // quando o assessor, já com a solução em mãos, percebe que os autos
  // precisam de mais apuração. Diferente de "Devolver para Correção"
  // (rejeição da Chefia sobre uma solução já escrita): aqui quem devolve é o
  // próprio assessor, antes de finalizar o parecer.
  // Zera só o prazo INTERNO/de trabalho (`dataInicioPrazo`, que nesta fase
  // guardava a data de recebimento dos autos para a solução) e registra o
  // novo prazo combinado com o Encarregado no campo `prazo` (Interno) — não
  // mexe em prazoFatal/finalPrazo/prazoFatalOverride ("Prazo Final"), que é
  // o prazo regulamentar do PA e não deve mudar por causa disso.
  const devolverParaEncarregado = async () => {
    const motivo = exposicaoMotivos.trim();
    if (!motivo) {
      toast.error("Escreva a exposição de motivos.");
      return;
    }
    if (!novoPrazoInterno) {
      toast.error("Informe o novo prazo para o Encarregado.");
      return;
    }
    try {
      setDevolvendoEncarregado(true);
      const processoRef = doc(db, "processos", p.id);
      const textoMovimento = `Processo devolvido ao Encarregado por ${autorMilitar}. Exposição de Motivos: ${motivo} Novo prazo combinado: ${formatarData(novoPrazoInterno)}.`;
      await updateDoc(processoRef, {
        situacaoFluxoPA: "COM_ENCARREGADO",
        dataInicioPrazo: null,
        prazo: novoPrazoInterno,
        descricao: textoMovimento,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });
      await addDoc(collection(db, `processos/${p.id}/historico`), {
        autor: autorMilitar,
        autorId,
        texto: textoMovimento,
        timestamp: new Date().toISOString(),
      });
      toast.success("Processo devolvido ao Encarregado.");
      setModalDevolverEncarregado(false);
      setExposicaoMotivos("");
      setNovoPrazoInterno("");
    } catch (error) {
      console.error("Erro ao devolver processo ao Encarregado:", error);
      registrarErro("CardPA.devolverParaEncarregado", error, { processoId: p.id });
      toast.error("Não foi possível devolver o processo ao Encarregado.");
    } finally {
      setDevolvendoEncarregado(false);
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
                <Badge variant="outline" className="text-[10px] h-5 border-green-400 text-green-800 bg-green-50">
                  Finalizado{p.atualizadoEm ? ` em ${formatarData(p.atualizadoEm)}` : ""}
                </Badge>
              ) : p.processoReaberto ? (
                <Badge variant="outline" className="text-[10px] h-5 border-blue-300 text-blue-700 bg-blue-50">Processo reaberto</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-800 bg-amber-50">{badgeExibicaoPA}</Badge>
              )}
              {sitPA === "FAZENDO_SOLUCAO" && p.prazoFatal && (
                <Badge variant="outline" className="text-[10px] h-5 border-orange-300 text-orange-800 bg-orange-50">
                  Prazo: {formatarData(p.prazoFatal)}
                </Badge>
              )}
              {sitPA === "ASSINANDO_SOLUCAO" && p.dataDespachoAssinatura && (
                <Badge variant="outline" className="text-[10px] h-5 border-violet-300 text-violet-800 bg-violet-50">
                  Prazo Assinatura: {formatarData(calcularPrazoAssinaturaSolucao(p.dataDespachoAssinatura, siteSettings?.prazoAssinaturaSolucaoDias))}
                </Badge>
              )}
            </div>
          </div>

          <h4 className="font-bold text-sm text-slate-800 leading-tight line-clamp-2">{p.tipoAcao}</h4>

          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            {p.prazo && (
              <div className="flex items-center gap-1 text-blue-600">
                <Clock className="w-3 h-3" /> <span className="font-semibold">Interno:</span> <span>{formatarData(p.prazo)}</span>
              </div>
            )}
          </div>

          {(p.status === "concluido"
            ? foiConcluidoForaDoPrazo(p.prazoFatal || p.finalPrazo, p.atualizadoEm)
            : nivelPA === "vencido_critico") && (
            <span className={`inline-flex items-center gap-1 self-start rounded-full bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${p.status === "concluido" ? "" : "animate-pulse"}`}>
              <AlertCircle className="w-3 h-3" />
              {p.status === "concluido"
                ? `Concluído Fora do Prazo${p.atualizadoEm ? ` em ${formatarData(p.atualizadoEm)}` : ""}`
                : "Vencido"}
            </span>
          )}

          <div className="text-xs text-slate-600 space-y-1">
            <p className="flex items-center gap-1"><User className="w-3 h-3" /> <strong>Parte:</strong> {p.cliente}</p>
            {p.dataEntrada && (
              <p className="flex items-center gap-1 text-slate-500"><Calendar className="w-3 h-3" /> <strong>Entrada:</strong> {formatarData(p.dataEntrada)}</p>
            )}
            {p.dataInicioPrazo && (
              <p className="flex items-center gap-1 text-purple-700 font-medium"><Calendar className="w-3 h-3" /> <strong>Início do Prazo:</strong> {formatarData(p.dataInicioPrazo)}</p>
            )}
            {p.prazoFatal && (
              <p className={`flex items-center gap-1 font-semibold ${diasRestantes(p.prazoFatal) <= 5 ? "text-red-600" : "text-orange-600"}`}>
                <AlertCircle className="w-3 h-3" /> <strong>Prazo Final:</strong> {formatarData(p.prazoFatal)}
              </p>
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

          {showActions && dentroDaMesaDoAssessor && p.situacaoFluxoPA === "FAZENDO_SOLUCAO" && (
            <Button
              size="sm"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 mt-1"
              disabled={enviandoSolucao}
              onClick={(e) => { e.stopPropagation(); marcarComoLido(); void enviarSolucaoParaAssinatura(); }}
            >
              <Send className="w-3 h-3 mr-1" /> {enviandoSolucao ? "Enviando..." : "Enviar Solução para Assinatura"}
            </Button>
          )}

          {showActions && dentroDaMesaDoAssessor && p.situacaoFluxoPA === "FAZENDO_SOLUCAO" && (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-orange-300 text-orange-700 hover:bg-orange-50 text-xs h-9"
              onClick={(e) => { e.stopPropagation(); marcarComoLido(); abrirDevolverEncarregado(); }}
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Devolver para o Encarregado
            </Button>
          )}

          {showActions && (() => {
            // V9.18 — "Ação" (modal completo do fluxo) some na Mesa do
            // Assessor: lá os atalhos dedicados (Enviar Solução/Devolver ao
            // Encarregado) já cobrem o que é preciso. Continua aparecendo
            // nas colunas de tipo (Sindicância/IPM/Conselho).
            // V9.27 — Investigação Preliminar/Outros não têm coluna de tipo
            // enquanto ativos (só ganham uma ao concluir) — a Mesa do
            // Assessor é o único lugar onde esse card aparece, então "Ação"
            // precisa continuar disponível ali, senão o processo fica sem
            // nenhum jeito de avançar o fluxo.
            const ehIPouOutros = resolverModalPA(p.tipoPA) === "IP";
            const mostrarAcao = !dentroDaMesaDoAssessor || ehIPouOutros;
            return (
            <div className="space-y-2 mt-3 pt-3 border-t border-slate-100">
              <div className={`grid gap-2 ${mostrarAcao ? "grid-cols-3" : (onEdit ? "grid-cols-2" : "grid-cols-1")}`}>
                {mostrarAcao && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs h-9"
                    onClick={(e) => { e.stopPropagation(); marcarComoLido(); setModalAcoesPA(true); }}
                  >
                    <FileText className="w-3 h-3 mr-1" /> Ação
                  </Button>
                )}
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
            );
          })()}

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
          return <AcoesPAModalV4 open={modalAcoesPA} onOpenChange={setModalAcoesPA} processoId={p.id} numeroProcesso={p.numero} siteSettings={siteSettings} onSuccess={() => {}} onSolicitarEdicao={() => onEdit?.(p)} />;
        })()}
      </Suspense>

      {modalDetalhes && <DetalhesModalPA open={modalDetalhes} onOpenChange={setModalDetalhes} processo={p} siteSettings={siteSettings} />}
      {modalChat && <ChatModal open={modalChat} onOpenChange={setModalChat} processo={p} />}

      {modalReativar && (
        <Dialog open={modalReativar} onOpenChange={setModalReativar}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Reabrir Processo {p.numero}</DialogTitle>
              <DialogDescription>
                {ehAdmin ? "Defina o novo prazo fatal para reabrir o processo." : "Informe o motivo da reabertura e defina o novo prazo fatal."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`motivo-${p.id}`}>Motivo da reabertura {!ehAdmin ? "*" : ""}</Label>
                <Textarea id={`motivo-${p.id}`} value={motivoReabertura} onChange={(e) => setMotivoReabertura(e.target.value)} placeholder="Descreva o motivo" rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`prazo-fatal-${p.id}`}>Novo prazo fatal *</Label>
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

      {modalDevolverEncarregado && (
        <Dialog open={modalDevolverEncarregado} onOpenChange={setModalDevolverEncarregado}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Devolver Processo {p.numero} ao Encarregado</DialogTitle>
              <DialogDescription>
                Escreva a exposição de motivos e informe o novo prazo combinado com o Encarregado. O prazo final do PA não é alterado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor={`exposicao-motivos-${p.id}`}>Exposição de Motivos *</Label>
                <Textarea
                  id={`exposicao-motivos-${p.id}`}
                  value={exposicaoMotivos}
                  onChange={(e) => setExposicaoMotivos(e.target.value)}
                  placeholder="Descreva o que precisa ser revisto/complementado pelo Encarregado"
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`novo-prazo-interno-${p.id}`}>Novo prazo para o Encarregado *</Label>
                <Input
                  id={`novo-prazo-interno-${p.id}`}
                  type="date"
                  value={novoPrazoInterno}
                  onChange={(e) => setNovoPrazoInterno(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalDevolverEncarregado(false)} disabled={devolvendoEncarregado}>Cancelar</Button>
              <Button type="button" onClick={() => void devolverParaEncarregado()} disabled={devolvendoEncarregado}>
                {devolvendoEncarregado ? "Devolvendo..." : "Confirmar Devolução"}
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
  // Precisa vir ANTES do atalho "pPrev === pNext" abaixo: a cor do assessor
  // é carregada de forma assíncrona (getDocs separado) e não faz parte do
  // objeto `processo`, então o objeto pode continuar o mesmo entre renders
  // enquanto só o corDestaque muda de undefined -> cor real. Sem essa
  // checagem, o card fica sem cor até algo mais forçar um re-render real.
  if (prevProps.corDestaque !== nextProps.corDestaque) return false;

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
