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
import { addDoc, collection, doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatarData } from "@/lib/prazo";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  LABEL_SITUACAO_PA,
  type SituacaoFluxoPA,
} from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";

// ---------------------------------------------------------------------------
// V4.0 — AcoesPAModalV4 (orquestrador de Processos Administrativos)
// V5.3: substituiu definitivamente o `AcoesPAModalNovo` legado. Implementa a
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
  // Mantidos por compatibilidade com a assinatura padrão dos modais de ação.
  // V4 ignora `siteSettings` (não utiliza configurações dinâmicas de fluxo).
  siteSettings?: SiteSettings;
  onSuccess?: () => void;
  // V9.5 — Solicitação de prorrogação delega 100% ao modal de edição (CadastroPA).
  // Quando o assessor clica em "Solicitar Prorrogação de Prazo", este modal é
  // fechado e o pai abre o CadastroPA com o processo carregado.
  onSolicitarEdicao?: () => void;
}

export function AcoesPAModalV4({
  open,
  onOpenChange,
  processoId,
  numeroProcesso,
  onSuccess,
  onSolicitarEdicao,
}: AcoesPAModalV4Props) {
  const { user } = useAuth();
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;

  const [dataCiente, setDataCiente] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [parte, setParte] = useState<string>("");
  const [situacaoAtualState, setSituacaoAtualState] = useState<SituacaoFluxoPA>("FAZENDO_PORTARIA");

  // V9.2 — Recebimento manual de autos (fase COM_ENCARREGADO).
  // Sugestão de 10 dias é aplicada apenas no momento de abrir o formulário;
  // depois disso o assessor edita livremente ambas as datas, sem recálculo silencioso.
  const [isRecebendoAutos, setIsRecebendoAutos] = useState<boolean>(false);
  const [dataRecebimento, setDataRecebimento] = useState<string>("");
  const [dataFatal, setDataFatal] = useState<string>("");

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

        // --- ADIÇÃO: AUTO-PREENCHIMENTO DA DATA DE CIENTE ---
        // Se o processo estiver aguardando entrega, preenche com hoje.
        if (sit === "AGUARDANDO_ENTREGA") {
          setDataCiente(new Date().toISOString().split('T')[0]);
        }
        // ----------------------------------------------------
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

  const somarDiasISO = (baseISO: string, dias: number) => {
    const base = baseISO ? new Date(`${baseISO}T00:00:00`) : new Date();
    if (Number.isNaN(base.getTime())) {
      const hoje = new Date();
      return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias).toISOString().slice(0, 10);
    }
    const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
    return dt.toISOString().slice(0, 10);
  };

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

  // V9.5 — Toda a lógica de datas/prazos foi removida deste modal. A prorrogação
  // de prazo é tratada exclusivamente pelo modal de edição (CadastroPA), que
  // possui o painel completo de prazos e prorrogações. O único fluxo manual de
  // datas que permanece aqui é "Receber Autos Concluídos" (encerramento da
  // sindicância pelo Encarregado).

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
              Autos com o Encarregado. Receba as conclusões ou solicite prorrogação de prazo (abre o modal de edição do processo).
            </p>

            {isRecebendoAutos ? (
              <div className="space-y-3 rounded-lg border border-indigo-300 bg-indigo-50 p-4 mt-4">
                <h5 className="text-sm font-semibold text-indigo-900">Confirmar Recebimento dos Autos</h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-indigo-800">Data do Recebimento</Label>
                    <Input
                      type="date"
                      value={dataRecebimento}
                      onChange={(e) => setDataRecebimento(e.target.value)}
                      className="border-indigo-200"
                    />
                  </div>
                  <div>
                    <Label className="text-indigo-800">Prazo da Solução (Fatal)</Label>
                    <Input
                      type="date"
                      value={dataFatal}
                      onChange={(e) => setDataFatal(e.target.value)}
                      className="border-indigo-200"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    disabled={salvando || !dataRecebimento || !dataFatal}
                    className={PRIMARY_BTN}
                    onClick={() => {
                      void avancarFluxo(
                        "FAZENDO_SOLUCAO",
                        {
                          dataInicioPrazo: dataRecebimento,
                          prazoFatal: dataFatal,
                          finalPrazo: dataFatal,
                          // Override manual: o assessor definiu explicitamente os prazos no formulário;
                          // useProcessos respeita prazoFatalOverride em vez de recalcular.
                          prazoFatalOverride: dataFatal,
                          status: "andamento",
                          descricao: `Sindicância recebida em ${formatarData(dataRecebimento)}. Prazo para solução ajustado para ${formatarData(dataFatal)}.`,
                        },
                        `Autos recebidos em ${formatarData(dataRecebimento)}. Prazo para solução ajustado para ${formatarData(dataFatal)}.`,
                      );
                      setIsRecebendoAutos(false);
                    }}
                  >
                    Confirmar Prazos
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    disabled={salvando}
                    onClick={() => setIsRecebendoAutos(false)}
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
                  onClick={() => {
                    // V9.5 — Delega 100% ao modal de edição (CadastroPA), que possui
                    // o painel completo de prazos e prorrogações. Fecha este modal e
                    // sinaliza o pai para abrir a edição do processo.
                    onOpenChange(false);
                    onSolicitarEdicao?.();
                  }}
                >
                  Solicitar Prorrogação de Prazo
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  className={PRIMARY_BTN}
                  onClick={() => {
                    const hoje = new Date().toISOString().slice(0, 10);
                    setDataRecebimento(hoje);
                    // Sugestão inicial de 10 dias — o assessor pode alterar livremente antes de confirmar.
                    setDataFatal(somarDiasISO(hoje, 10));
                    setIsRecebendoAutos(true);
                  }}
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
