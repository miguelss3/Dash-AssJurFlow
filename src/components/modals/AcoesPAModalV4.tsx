import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDoc, arrayUnion, collection, doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  LABEL_SITUACAO_PA,
  type SituacaoFluxoPA,
} from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";

// ---------------------------------------------------------------------------
// V4.0 — AcoesPAModalV4 (orquestrador de Processos Administrativos)
// Componente PARALELO ao `AcoesPAModalNovo` legado. Implementa a nova
// máquina de estados em 6+1 etapas. NÃO substitui o modal antigo: deve
// ser plugado nas listas/Kanban somente após validação manual.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// V4.4 — Tradutor heurístico de PAs legados.
// Processos PA criados antes da migração não possuem `situacaoFluxoPA`.
// Inferimos a etapa nova lendo as variáveis legadas (dataInicioPrazo,
// dataAssinatura, aguardandoAssinaturaCmt, descricao). Mantemos a ordem
// dos checks do mais avançado para o mais inicial — o primeiro match vence.
// ---------------------------------------------------------------------------
const getSituacaoInicial = (p: Record<string, unknown>): SituacaoFluxoPA => {
  // 1. Já migrado: confia na fase salva.
  const sitNova = p.situacaoFluxoPA as SituacaoFluxoPA | undefined;
  if (sitNova) return sitNova;

  // 2. Finalizado.
  if (p.finalizado || p.status === "concluido") return "FINALIZADO";

  // 3. Fase de Solução (heurística textual em descricao).
  const desc = ((p.descricao as string | undefined) || "").toLowerCase();
  if (desc.includes("confecção da solução") || desc.includes("confeccao da solucao") || desc.includes("parecer")) {
    return "FAZENDO_SOLUCAO";
  }

  // 4. Prazo iniciado → autos com o Encarregado.
  if (p.dataInicioPrazo) return "COM_ENCARREGADO";

  // 5. Portaria assinada (ou status legado AGUARDANDO_PRAZO), aguardando entrega.
  if (
    p.dataAssinatura
    || p.portariaAssinadaEm
    || ((p.situacaoFluxo as string | undefined) || "").toString().toUpperCase() === "AGUARDANDO_PRAZO"
  ) {
    return "AGUARDANDO_ENTREGA";
  }

  // 6. Na Chefia/Cmt aguardando a caneta.
  const sitLegado = ((p.situacaoFluxo as string | undefined) || "").toString().toUpperCase();
  if (sitLegado === "AGUARDANDO_CHEFIA" || p.aguardandoAssinaturaCmt) return "ASSINANDO_PORTARIA";

  // 7. Fallback real: minuta sendo elaborada.
  return "FAZENDO_PORTARIA";
};

interface AcoesPAModalV4Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  // Mantidos por compatibilidade com a assinatura legada do AcoesPAModalNovo.
  // V4 ignora `siteSettings` (não utiliza configurações dinâmicas de fluxo).
  siteSettings?: SiteSettings;
  onSuccess?: () => void;
}

export function AcoesPAModalV4({
  open,
  onOpenChange,
  processoId,
  numeroProcesso,
  onSuccess,
}: AcoesPAModalV4Props) {
  const { user } = useAuth();
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;

  const [dataCiente, setDataCiente] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [parte, setParte] = useState<string>("");
  const [situacaoAtualState, setSituacaoAtualState] = useState<SituacaoFluxoPA>("FAZENDO_PORTARIA");

  // V4.5 — Estado da prorrogação de prazo (fase COM_ENCARREGADO).
  const [isProrrogando, setIsProrrogando] = useState<boolean>(false);
  const [diasProrrogacao, setDiasProrrogacao] = useState<number>(20);
  const [docProrrogacao, setDocProrrogacao] = useState<string>("");
  const [prazoFatalAtual, setPrazoFatalAtual] = useState<string>("");
  const [dataInicioPrazoAtual, setDataInicioPrazoAtual] = useState<string>("");

  // ---------------- Carga ----------------
  useEffect(() => {
    if (!open || !processoId) return;
    let cancelado = false;
    setCarregando(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "processos", processoId));
        if (cancelado) return;
        const data = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
        // V4.4 — Tradutor heurístico aplicado na carga.
        const sit = getSituacaoInicial(data);
        setSituacaoAtualState(sit);
        setParte(((data?.cliente as string | undefined) || "").toString());
        // V4.5 — Captura prazos atuais para o motor de prorrogação.
        setPrazoFatalAtual(
          ((data?.prazoFatal as string | undefined)
            || (data?.finalPrazo as string | undefined)
            || "").toString(),
        );
        setDataInicioPrazoAtual(((data?.dataInicioPrazo as string | undefined) || "").toString());
      } catch (error) {
        console.error("Erro ao carregar fluxo PA:", error);
        toast.error("Não foi possível carregar o fluxo do processo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, processoId]);

  const situacaoAtual: SituacaoFluxoPA = useMemo(() => situacaoAtualState, [situacaoAtualState]);

  // ---------------- Persistência ----------------
  const avancarFluxo = async (
    novaSituacao: SituacaoFluxoPA,
    extraData: Record<string, unknown> = {},
    msgHistorico: string,
  ) => {
    if (!processoId || !user) return;
    setSalvando(true);
    try {
      const processoRef = doc(db, "processos", processoId);
      const payload: Record<string, unknown> = {
        situacaoFluxoPA: novaSituacao,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        ...extraData,
      };
      if (novaSituacao === "FINALIZADO") {
        payload.finalizado = true;
      }
      await updateDoc(processoRef, payload);
      await addDoc(collection(db, `processos/${processoId}/historico`), {
        autor: autorMilitar,
        autorId: user.uid || "sistema",
        texto: msgHistorico,
        timestamp: new Date().toISOString(),
      });
      toast.success("Fluxo PA atualizado.");
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao avançar fluxo PA:", error);
      toast.error("Não foi possível atualizar o fluxo PA.");
    } finally {
      setSalvando(false);
    }
  };

  // ---------------- V4.5 — Motor de Prorrogação ----------------
  // Soma `diasProrrogacao` ao prazo fatal corrente (prazoFatal → finalPrazo →
  // dataInicioPrazo → hoje, nessa ordem) e grava o novo prazo nos dois campos
  // de raiz (prazoFatal/finalPrazo) usados pelo Kanban e pelo Calendário.
  // Mantém histórico imutável via arrayUnion em `prorrogacoes`.
  const handleProrrogar = async () => {
    if (!processoId || !user) return;
    const dias = Number(diasProrrogacao);
    if (!Number.isFinite(dias) || dias <= 0) {
      toast.error("Informe um número válido de dias.");
      return;
    }
    const docNumero = docProrrogacao.trim();
    if (!docNumero) {
      toast.error("Informe o documento de referência da prorrogação.");
      return;
    }
    setSalvando(true);
    try {
      const baseStr = prazoFatalAtual || dataInicioPrazoAtual || "";
      const base = baseStr ? new Date(baseStr) : new Date();
      if (Number.isNaN(base.getTime())) {
        toast.error("Não foi possível ler o prazo atual do processo.");
        return;
      }
      base.setDate(base.getDate() + dias);
      const novoPrazoISO = base.toISOString().slice(0, 10);

      const novaProrrogacao = {
        dias,
        doc: docNumero,
        por: autorMilitar,
        em: new Date().toISOString(),
      };

      const processoRef = doc(db, "processos", processoId);
      await updateDoc(processoRef, {
        prazoFatal: novoPrazoISO,
        finalPrazo: novoPrazoISO,
        prorrogacoes: arrayUnion(novaProrrogacao),
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });
      const msg = `Prazo prorrogado em +${dias} dias. Doc: ${docNumero}`;
      await addDoc(collection(db, `processos/${processoId}/historico`), {
        autor: autorMilitar,
        autorId: user.uid || "sistema",
        texto: msg,
        timestamp: new Date().toISOString(),
      });

      toast.success("Prazo prorrogado com sucesso.");
      setPrazoFatalAtual(novoPrazoISO);
      setIsProrrogando(false);
      setDocProrrogacao("");
      setDiasProrrogacao(20);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao prorrogar prazo PA:", error);
      toast.error("Não foi possível prorrogar o prazo.");
    } finally {
      setSalvando(false);
    }
  };

  // V4.0.1 — Classes utilitárias clonadas do AcoesDUModalNovo para garantir
  // identidade visual única entre os fluxos DU e PA.
  const PRIMARY_BTN =
    "w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const SECONDARY_BTN =
    "w-full py-3 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
  const FORM_CONTAINER = "p-5 border border-slate-200 rounded-xl mb-4 bg-slate-50";

  // ---------------- Renderização por etapa ----------------
  const renderAcoes = () => {
    switch (situacaoAtual) {
      case "FAZENDO_PORTARIA":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Elaboração da Portaria</h4>
            <p className="text-xs text-slate-600 mb-4">
              Conclua a minuta da Portaria e despache para assinatura da Chefia/Cmt.
            </p>
            <button
              type="button"
              disabled={salvando}
              className={PRIMARY_BTN}
              onClick={() =>
                void avancarFluxo(
                  "ASSINANDO_PORTARIA",
                  {},
                  "Minuta da Portaria despachada para a Chefia.",
                )
              }
            >
              Despachar para Chefia/Cmt
            </button>
          </div>
        );

      case "ASSINANDO_PORTARIA":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Assinatura da Portaria</h4>
            <p className="text-xs text-slate-600 mb-4">
              Aguardando assinatura da Chefia/Cmt. Confirme quando assinada.
            </p>
            <button
              type="button"
              disabled={salvando}
              className={PRIMARY_BTN}
              onClick={() =>
                void avancarFluxo(
                  "AGUARDANDO_ENTREGA",
                  {},
                  "Portaria assinada. Aguardando entrega ao Encarregado.",
                )
              }
            >
              Confirmar Assinatura
            </button>
          </div>
        );

      case "AGUARDANDO_ENTREGA":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Entrega ao Encarregado</h4>
            <p className="text-xs text-slate-600 mb-4">
              Registre a data do ciente do Encarregado para iniciar o prazo regulamentar.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="data-ciente" className="text-slate-700">
                  Data do Ciente do Encarregado
                </Label>
                <Input
                  id="data-ciente"
                  type="date"
                  value={dataCiente}
                  onChange={(e) => setDataCiente(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={salvando || !dataCiente}
                className={PRIMARY_BTN}
                onClick={() => {
                  if (!dataCiente) {
                    toast.error("Informe a data do ciente.");
                    return;
                  }
                  void avancarFluxo(
                    "COM_ENCARREGADO",
                    { dataInicioPrazo: dataCiente },
                    "Portaria entregue ao encarregado. Prazo iniciado.",
                  );
                }}
              >
                Entregar e Iniciar Prazo
              </button>
            </div>
          </div>
        );

      case "COM_ENCARREGADO":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Sindicância em curso</h4>
            <p className="text-xs text-slate-600 mb-4">
              Autos com o Encarregado. Receba as conclusões ou prorrogue o prazo, se necessário.
            </p>
            {(prazoFatalAtual || dataInicioPrazoAtual) && (
              <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-slate-700">
                {dataInicioPrazoAtual && (
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Início do Prazo</div>
                    <div>{dataInicioPrazoAtual}</div>
                  </div>
                )}
                {prazoFatalAtual && (
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Prazo Fatal Atual</div>
                    <div>{prazoFatalAtual}</div>
                  </div>
                )}
              </div>
            )}

            {isProrrogando ? (
              <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-4">
                <h5 className="text-sm font-semibold text-slate-800">Prorrogação de Prazo</h5>
                <div>
                  <Label htmlFor="prorr-dias" className="text-slate-700">Dias</Label>
                  <Input
                    id="prorr-dias"
                    type="number"
                    min={1}
                    value={diasProrrogacao}
                    onChange={(e) => setDiasProrrogacao(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="prorr-doc" className="text-slate-700">
                    Documento (Ex: Nota nº 123/2026)
                  </Label>
                  <Input
                    id="prorr-doc"
                    type="text"
                    value={docProrrogacao}
                    onChange={(e) => setDocProrrogacao(e.target.value)}
                    placeholder="Nota nº ___/____"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={salvando || !docProrrogacao.trim() || !diasProrrogacao}
                    className={PRIMARY_BTN}
                    onClick={() => void handleProrrogar()}
                  >
                    Confirmar Prorrogação
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    disabled={salvando}
                    onClick={() => {
                      setIsProrrogando(false);
                      setDocProrrogacao("");
                      setDiasProrrogacao(20);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  className={SECONDARY_BTN}
                  disabled={salvando}
                  onClick={() => setIsProrrogando(true)}
                >
                  Solicitar Prorrogação de Prazo
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  className={PRIMARY_BTN}
                  onClick={() =>
                    void avancarFluxo(
                      "FAZENDO_SOLUCAO",
                      {},
                      "Autos entregues pelo Encarregado. Iniciando fase de Solução/Parecer.",
                    )
                  }
                >
                  Receber Autos Concluídos
                </button>
              </div>
            )}
          </div>
        );

      case "FAZENDO_SOLUCAO":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Solução / Parecer</h4>
            <p className="text-xs text-slate-600 mb-4">
              Elabore a Solução do processo e despache para assinatura da Chefia/Cmt.
            </p>
            <button
              type="button"
              disabled={salvando}
              className={PRIMARY_BTN}
              onClick={() =>
                void avancarFluxo(
                  "ASSINANDO_SOLUCAO",
                  {},
                  "Solução despachada para assinatura da Chefia/Cmt.",
                )
              }
            >
              Despachar Solução para Chefia
            </button>
          </div>
        );

      case "ASSINANDO_SOLUCAO":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Assinatura da Solução</h4>
            <p className="text-xs text-slate-600 mb-4">
              Aguardando assinatura final da Solução pela Chefia/Cmt.
            </p>
            <button
              type="button"
              disabled={salvando}
              className={PRIMARY_BTN}
              onClick={() =>
                void avancarFluxo(
                  "FINALIZADO",
                  { finalizado: true, status: "concluido" },
                  "Processo Administrativo finalizado.",
                )
              }
            >
              Finalizar Processo
            </button>
          </div>
        );

      case "FINALIZADO":
      default:
        return (
          <div className={FORM_CONTAINER}>
            <p className="text-center text-sm text-slate-600">Processo encerrado.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações PA - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Fluxo do Processo Administrativo (V4.0).
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white p-3 flex items-center gap-2 rounded-lg border border-slate-200 mb-6 text-sm text-slate-700 shadow-sm">
          <span className="font-semibold text-slate-800">Situação atual:</span>
          <span>{LABEL_SITUACAO_PA[situacaoAtual]}</span>
          {parte && (
            <span className="ml-auto text-xs text-slate-500">Parte: {parte}</span>
          )}
        </div>

        {carregando ? (
          <div className="p-5 border border-slate-200 rounded-xl mb-4 bg-slate-50 text-center text-sm text-slate-600">
            Carregando ações do processo...
          </div>
        ) : (
          renderAcoes()
        )}
      </DialogContent>
    </Dialog>
  );
}
