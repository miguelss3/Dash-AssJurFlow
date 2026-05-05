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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  LABEL_SITUACAO_CONSELHO,
  type SituacaoFluxoConselho,
} from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";

// ---------------------------------------------------------------------------
// V5.0 — AcoesConselhoModalV4
// Motor de estados exclusivo de Conselhos de Disciplina/Justificação.
// Paralelo ao AcoesPAModalV4 (Sindicâncias/IPMs); não substitui nenhuma
// tela antiga até validação manual. Visual idêntico ao AcoesDU/PA V4
// (slate-50 / slate-900, sem verde).
// ---------------------------------------------------------------------------

interface AcoesConselhoModalV4Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  siteSettings?: SiteSettings; // mantido por compat com a assinatura PA
  onSuccess?: () => void;
}

// Soma `dias` corridos em uma data ISO (YYYY-MM-DD) e devolve ISO curto.
const somarDiasISO = (baseISO: string, dias: number): string => {
  const base = baseISO ? new Date(baseISO) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + dias);
  return base.toISOString().slice(0, 10);
};

export function AcoesConselhoModalV4({
  open,
  onOpenChange,
  processoId,
  numeroProcesso,
  onSuccess,
}: AcoesConselhoModalV4Props) {
  const { user } = useAuth();
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;

  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [parte, setParte] = useState<string>("");
  const [situacaoAtualState, setSituacaoAtualState] =
    useState<SituacaoFluxoConselho>("FAZENDO_PORTARIA");

  // Campos do processo carregados do Firestore.
  const [numeroMemoriaAth, setNumeroMemoriaAth] = useState<string>("");
  const [prazoFatalAtual, setPrazoFatalAtual] = useState<string>("");
  const [dataInicioPrazoAtual, setDataInicioPrazoAtual] = useState<string>("");

  // Inputs voláteis das fases.
  const [dataAssinatura, setDataAssinatura] = useState<string>("");
  const [memoriaAthInput, setMemoriaAthInput] = useState<string>("");
  const [isProrrogando, setIsProrrogando] = useState<boolean>(false);
  const [docProrrogacao, setDocProrrogacao] = useState<string>("");
  const [numeroBarProrrogacao, setNumeroBarProrrogacao] = useState<string>("");
  const [dataBarProrrogacao, setDataBarProrrogacao] = useState<string>("");
  const [teveRecurso, setTeveRecurso] = useState<"SIM" | "NAO" | "">("");
  const [docEnvioAth, setDocEnvioAth] = useState<string>("");

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
        // Fallback: Conselhos antigos sem flag entram em FAZENDO_PORTARIA.
        const sit = (data?.situacaoFluxoConselho as SituacaoFluxoConselho | undefined)
          || "FAZENDO_PORTARIA";
        setSituacaoAtualState(sit);
        setParte(((data?.cliente as string | undefined) || "").toString());
        setNumeroMemoriaAth(((data?.numeroMemoriaAth as string | undefined) || "").toString());
        setPrazoFatalAtual(
          ((data?.prazoFatal as string | undefined)
            || (data?.finalPrazo as string | undefined)
            || "").toString(),
        );
        setDataInicioPrazoAtual(((data?.dataInicioPrazo as string | undefined) || "").toString());
        // Pré-preenche o campo de input com o valor já gravado, quando houver.
        setMemoriaAthInput(((data?.numeroMemoriaAth as string | undefined) || "").toString());
      } catch (error) {
        console.error("Erro ao carregar fluxo Conselho:", error);
        toast.error("Não foi possível carregar o fluxo do Conselho.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, processoId]);

  const situacaoAtual: SituacaoFluxoConselho = useMemo(
    () => situacaoAtualState,
    [situacaoAtualState],
  );

  // ---------------- Persistência ----------------
  const avancarFluxo = async (
    novaSituacao: SituacaoFluxoConselho,
    extraData: Record<string, unknown> = {},
    msgHistorico: string,
  ) => {
    if (!processoId || !user) return;
    setSalvando(true);
    try {
      const processoRef = doc(db, "processos", processoId);
      const payload: Record<string, unknown> = {
        situacaoFluxoConselho: novaSituacao,
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
      toast.success("Fluxo do Conselho atualizado.");
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao avançar fluxo Conselho:", error);
      toast.error("Não foi possível atualizar o fluxo do Conselho.");
    } finally {
      setSalvando(false);
    }
  };

  // V4.0.1 — Identidade visual única (clones do AcoesDU/PA).
  const PRIMARY_BTN =
    "w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const SECONDARY_BTN =
    "w-full py-3 rounded-xl text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
  const FORM_CONTAINER = "p-5 border border-slate-200 rounded-xl mb-4 bg-slate-50";

  // ---------------- Render por etapa ----------------
  const renderAcoes = () => {
    switch (situacaoAtual) {
      case "FAZENDO_PORTARIA": {
        const memoriaSalva = numeroMemoriaAth.trim();
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Elaboração da Portaria</h4>
            <p className="text-xs text-slate-600 mb-4">
              Confirme o número da Memória ATH antes de despachar a Portaria para a Chefia.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="memoria-ath" className="text-slate-700">
                  Número da Memória ATH
                </Label>
                <Input
                  id="memoria-ath"
                  type="text"
                  value={memoriaAthInput}
                  onChange={(e) => setMemoriaAthInput(e.target.value)}
                  placeholder="Ex: Memória ATH nº 12/2026"
                  disabled={!!memoriaSalva}
                />
                {memoriaSalva && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Memória registrada no cadastro: <strong>{memoriaSalva}</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={salvando || !memoriaAthInput.trim()}
                className={PRIMARY_BTN}
                onClick={() => {
                  const memoria = memoriaAthInput.trim();
                  if (!memoria) {
                    toast.error("Informe o número da Memória ATH.");
                    return;
                  }
                  void avancarFluxo(
                    "ASSINANDO_PORTARIA",
                    { numeroMemoriaAth: memoria },
                    `Portaria do Conselho despachada para a Chefia. Memória ATH: ${memoria}.`,
                  );
                }}
              >
                Despachar Portaria para Chefia
              </button>
            </div>
          </div>
        );
      }

      case "ASSINANDO_PORTARIA":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Assinatura da Portaria</h4>
            <p className="text-xs text-slate-600 mb-4">
              Registre a data de assinatura. O prazo do Conselho começa em D+1 e dura
              30 dias corridos.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="data-assinatura" className="text-slate-700">
                  Data da Assinatura
                </Label>
                <Input
                  id="data-assinatura"
                  type="date"
                  value={dataAssinatura}
                  onChange={(e) => setDataAssinatura(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={salvando || !dataAssinatura}
                className={PRIMARY_BTN}
                onClick={() => {
                  if (!dataAssinatura) {
                    toast.error("Informe a data de assinatura.");
                    return;
                  }
                  const dataInicioPrazo = somarDiasISO(dataAssinatura, 1);
                  const prazoFatal = somarDiasISO(dataInicioPrazo, 30);
                  if (!dataInicioPrazo || !prazoFatal) {
                    toast.error("Não foi possível calcular o prazo a partir da data informada.");
                    return;
                  }
                  void avancarFluxo(
                    "COM_CONSELHO",
                    {
                      dataAssinatura,
                      dataInicioPrazo,
                      prazoFatal,
                      finalPrazo: prazoFatal,
                    },
                    `Portaria assinada em ${dataAssinatura}. Prazo iniciado em ${dataInicioPrazo} (fatal ${prazoFatal}).`,
                  );
                }}
              >
                Registrar Assinatura e Iniciar Prazo
              </button>
            </div>
          </div>
        );

      case "COM_CONSELHO":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Conselho em curso</h4>
            <p className="text-xs text-slate-600 mb-4">
              Autos com o Conselho. Receba os autos concluídos ou solicite prorrogação de prazo.
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
                <h5 className="text-sm font-semibold text-slate-800">Solicitação de Prorrogação</h5>
                <div>
                  <Label htmlFor="doc-prorr-conselho" className="text-slate-700">
                    Documento da Solicitação (Ex: Memória nº ___/____)
                  </Label>
                  <Input
                    id="doc-prorr-conselho"
                    type="text"
                    value={docProrrogacao}
                    onChange={(e) => setDocProrrogacao(e.target.value)}
                    placeholder="Memória nº ___/____"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={salvando || !docProrrogacao.trim()}
                    className={PRIMARY_BTN}
                    onClick={() => {
                      const docNum = docProrrogacao.trim();
                      if (!docNum) {
                        toast.error("Informe o documento de solicitação.");
                        return;
                      }
                      void avancarFluxo(
                        "AGUARDANDO_DESPACHO_PRORROGACAO",
                        { pendenciaProrrogacao: docNum },
                        `Solicitação de prorrogação enviada. Doc: ${docNum}.`,
                      );
                    }}
                  >
                    Confirmar Solicitação
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    disabled={salvando}
                    onClick={() => {
                      setIsProrrogando(false);
                      setDocProrrogacao("");
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
                      "TRIAGEM_AUTOS",
                      {},
                      "Autos do Conselho recebidos. Iniciando triagem.",
                    )
                  }
                >
                  Receber Autos Concluídos
                </button>
              </div>
            )}
          </div>
        );

      case "AGUARDANDO_DESPACHO_PRORROGACAO":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Despacho de Prorrogação</h4>
            <p className="text-xs text-slate-600 mb-4">
              Registre o BAR/Despacho que autorizou a prorrogação. Serão somados 20 dias corridos
              ao prazo fatal vigente.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="bar-numero" className="text-slate-700">
                  Número do BAR/Despacho
                </Label>
                <Input
                  id="bar-numero"
                  type="text"
                  value={numeroBarProrrogacao}
                  onChange={(e) => setNumeroBarProrrogacao(e.target.value)}
                  placeholder="Ex: BAR nº 045/2026"
                />
              </div>
              <div>
                <Label htmlFor="bar-data" className="text-slate-700">
                  Data do BAR/Despacho
                </Label>
                <Input
                  id="bar-data"
                  type="date"
                  value={dataBarProrrogacao}
                  onChange={(e) => setDataBarProrrogacao(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={salvando || !numeroBarProrrogacao.trim() || !dataBarProrrogacao}
                className={PRIMARY_BTN}
                onClick={() => {
                  const numBar = numeroBarProrrogacao.trim();
                  if (!numBar || !dataBarProrrogacao) {
                    toast.error("Preencha número e data do BAR/Despacho.");
                    return;
                  }
                  const baseStr = prazoFatalAtual || dataInicioPrazoAtual || "";
                  const novoPrazoFatal = somarDiasISO(baseStr, 20);
                  if (!novoPrazoFatal) {
                    toast.error("Não foi possível calcular o novo prazo fatal.");
                    return;
                  }
                  const registroProrrogacao = {
                    dias: 20,
                    doc: numBar,
                    em: new Date().toISOString(),
                    por: autorMilitar,
                    inicio: prazoFatalAtual || undefined,
                    fim: novoPrazoFatal,
                  };
                  void avancarFluxo(
                    "COM_CONSELHO",
                    {
                      prazoFatal: novoPrazoFatal,
                      finalPrazo: novoPrazoFatal,
                      prorrogacoes: arrayUnion(registroProrrogacao),
                      pendenciaProrrogacao: null,
                    },
                    `Prorrogação concedida via ${numBar} (${dataBarProrrogacao}). Novo prazo fatal: ${novoPrazoFatal}.`,
                  );
                }}
              >
                Confirmar Prorrogação e Retomar Prazo
              </button>
            </div>
          </div>
        );

      case "TRIAGEM_AUTOS":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Triagem dos Autos</h4>
            <p className="text-xs text-slate-600 mb-4">
              Verifique se houve recurso do acusado contra a conclusão do Conselho.
            </p>
            <div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-white p-3">
                <Label className="text-slate-700 text-xs font-bold uppercase mb-2 block">
                  Houve recurso do acusado?
                </Label>
                <RadioGroup
                  value={teveRecurso}
                  onValueChange={(v) => setTeveRecurso(v as "SIM" | "NAO")}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="SIM" id="recurso-sim" />
                    <Label htmlFor="recurso-sim" className="font-normal cursor-pointer">Sim</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NAO" id="recurso-nao" />
                    <Label htmlFor="recurso-nao" className="font-normal cursor-pointer">Não</Label>
                  </div>
                </RadioGroup>
              </div>
              <button
                type="button"
                disabled={salvando || !teveRecurso}
                className={PRIMARY_BTN}
                onClick={() => {
                  if (teveRecurso === "SIM") {
                    const hojeISO = new Date().toISOString().slice(0, 10);
                    const prazoResposta = somarDiasISO(hojeISO, 20);
                    void avancarFluxo(
                      "FAZENDO_RESPOSTA_RECURSO",
                      { teveRecurso: true, prazoRespostaRecurso: prazoResposta },
                      `Triagem: houve recurso. Prazo para resposta: ${prazoResposta}.`,
                    );
                  } else if (teveRecurso === "NAO") {
                    void avancarFluxo(
                      "DECISAO_AUTORIDADE",
                      { teveRecurso: false },
                      "Triagem: sem recurso. Encaminhado para decisão da autoridade.",
                    );
                  }
                }}
              >
                Confirmar Triagem
              </button>
            </div>
          </div>
        );

      case "FAZENDO_RESPOSTA_RECURSO":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Resposta a Recurso</h4>
            <p className="text-xs text-slate-600 mb-4">
              Elabore a resposta ao recurso e despache para a Chefia. Após o despacho o
              processo segue para decisão da autoridade.
            </p>
            <button
              type="button"
              disabled={salvando}
              className={PRIMARY_BTN}
              onClick={() =>
                void avancarFluxo(
                  "DECISAO_AUTORIDADE",
                  {},
                  "Resposta a recurso despachada para a Chefia.",
                )
              }
            >
              Despachar Resposta para Chefia
            </button>
          </div>
        );

      case "DECISAO_AUTORIDADE":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Decisão da Autoridade</h4>
            <p className="text-xs text-slate-600 mb-4">
              Aguardando decisão da autoridade nomeante. Confirme o registro para liberar o
              envio à ATH.
            </p>
            <button
              type="button"
              disabled={salvando}
              className={PRIMARY_BTN}
              onClick={() =>
                void avancarFluxo(
                  "ENVIO_ATH",
                  {},
                  "Decisão da autoridade registrada. Pendente envio à ATH.",
                )
              }
            >
              Registrar Decisão Final
            </button>
          </div>
        );

      case "ENVIO_ATH":
        return (
          <div className={FORM_CONTAINER}>
            <h4 className="text-sm font-semibold text-slate-800 mb-1">Envio à ATH</h4>
            <p className="text-xs text-slate-600 mb-4">
              Informe o documento de remessa à ATH para finalizar o processo.
            </p>
            <div className="space-y-3">
              <div>
                <Label htmlFor="doc-envio-ath" className="text-slate-700">
                  Documento de Remessa à ATH
                </Label>
                <Input
                  id="doc-envio-ath"
                  type="text"
                  value={docEnvioAth}
                  onChange={(e) => setDocEnvioAth(e.target.value)}
                  placeholder="Ex: DiEx nº ___/____"
                />
              </div>
              <button
                type="button"
                disabled={salvando || !docEnvioAth.trim()}
                className={PRIMARY_BTN}
                onClick={() => {
                  const docNum = docEnvioAth.trim();
                  if (!docNum) {
                    toast.error("Informe o documento de remessa à ATH.");
                    return;
                  }
                  void avancarFluxo(
                    "FINALIZADO",
                    { finalizado: true, docEnvioAth: docNum, status: "concluido" },
                    `Conselho finalizado. Remetido à ATH via ${docNum}.`,
                  );
                }}
              >
                Registrar Envio à ATH e Finalizar
              </button>
            </div>
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
          <DialogTitle>Ações Conselho - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Fluxo do Conselho de Disciplina/Justificação (V5.0).
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white p-3 flex items-center gap-2 rounded-lg border border-slate-200 mb-6 text-sm text-slate-700 shadow-sm">
          <span className="font-semibold text-slate-800">Situação atual:</span>
          <span>{LABEL_SITUACAO_CONSELHO[situacaoAtual]}</span>
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
