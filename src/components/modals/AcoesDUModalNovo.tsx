import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import {
  ArrowRightCircle,
  CalendarIcon,
  CheckCircle2,
  Clock,
  FileSignature,
  Flag,
  Inbox,
  Lock,
  Repeat,
  Send,
  ShieldCheck,
} from "lucide-react";

type SituacaoFluxoDU =
  | "MESA_ASSESSOR"
  | "CHEFIA_DILIGENCIA"
  | "AGUARDANDO_CHEM_DILIGENCIA"
  | "AGUARDANDO_RESPOSTA"
  | "CRIANDO_REITERACAO"
  | "CHEFIA_DEFESA"
  | "AGUARDANDO_CHEM_DEFESA"
  | "APTO_FINALIZAR";

type AcaoPrincipal = "DILIGENCIA" | "DEFESA";
type TipoDiligencia = "INTERNO" | "EXTERNO";

interface AcoesDUModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onSuccess?: () => void;
}

const SITUACAO_ALIAS: Record<string, SituacaoFluxoDU> = {
  aguardando_assinatura_secao: "CHEFIA_DILIGENCIA",
  aguardando_aprovacao_externa: "CHEFIA_DILIGENCIA",
  enviado_admin: "CHEFIA_DILIGENCIA",
  devolvido_assessor_interno: "MESA_ASSESSOR",
  devolvido_assessor_externo: "MESA_ASSESSOR",
  devolvido_assessor_com_diex: "MESA_ASSESSOR",
  aprovado_externo_enviado_chem: "AGUARDANDO_CHEM_DILIGENCIA",
  aprovado_externo_aguardando_chem: "AGUARDANDO_CHEM_DILIGENCIA",
  assinado_externo: "AGUARDANDO_CHEM_DILIGENCIA",
  resposta_assinada_chem: "APTO_FINALIZAR",
};

const statusPorSituacao: Record<SituacaoFluxoDU, string> = {
  MESA_ASSESSOR: "Em Andamento",
  CHEFIA_DILIGENCIA: "Aguardando Ação da Chefia",
  AGUARDANDO_CHEM_DILIGENCIA: "Aguardando Assinatura do CHEM",
  AGUARDANDO_RESPOSTA: "Aguardando Resposta",
  CRIANDO_REITERACAO: "Preparando Reiteração",
  CHEFIA_DEFESA: "Aguardando Ação da Chefia",
  AGUARDANDO_CHEM_DEFESA: "Aguardando Assinatura do CHEM",
  APTO_FINALIZAR: "Aguardando Finalização DU",
};

const descricaoPorSituacao: Record<SituacaoFluxoDU, string> = {
  MESA_ASSESSOR: "Processo devolvido à mesa do assessor.",
  CHEFIA_DILIGENCIA: "Assessor enviou diligência para decisão da chefia.",
  AGUARDANDO_CHEM_DILIGENCIA: "Chefia aprovou e encaminhou para assinatura do CHEM.",
  AGUARDANDO_RESPOSTA: "Diligência emitida. Aguardando resposta da seção/OM.",
  CRIANDO_REITERACAO: "Reiteração em elaboração pelo assessor.",
  CHEFIA_DEFESA: "Minuta de defesa encaminhada para decisão da chefia.",
  AGUARDANDO_CHEM_DEFESA: "Defesa aprovada pela chefia e aguardando assinatura do CHEM.",
  APTO_FINALIZAR: "Documento final registrado. Processo apto para finalização.",
};

const normalizeSituacao = (situacao?: string): SituacaoFluxoDU => {
  if (!situacao) return "MESA_ASSESSOR";
  if (([
    "MESA_ASSESSOR",
    "CHEFIA_DILIGENCIA",
    "AGUARDANDO_CHEM_DILIGENCIA",
    "AGUARDANDO_RESPOSTA",
    "CRIANDO_REITERACAO",
    "CHEFIA_DEFESA",
    "AGUARDANDO_CHEM_DEFESA",
    "APTO_FINALIZAR",
  ] as string[]).includes(situacao)) {
    return situacao as SituacaoFluxoDU;
  }
  return SITUACAO_ALIAS[situacao] || "MESA_ASSESSOR";
};

export function AcoesDUModalNovo({ open, onOpenChange, processoId, numeroProcesso, onSuccess }: AcoesDUModalNovoProps) {
  const { user } = useAuth();
  const ehChefia = isAdmin(user);
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;

  const [situacaoFluxo, setSituacaoFluxo] = useState<SituacaoFluxoDU>("MESA_ASSESSOR");
  const [acaoPrincipal, setAcaoPrincipal] = useState<AcaoPrincipal>("DILIGENCIA");
  const [tipoDiligencia, setTipoDiligencia] = useState<TipoDiligencia>("INTERNO");
  const [dataPrazo, setDataPrazo] = useState("");
  const [numeroSaida, setNumeroSaida] = useState("");
  const [numeroSaidaSalvo, setNumeroSaidaSalvo] = useState(false);
  const [numeroRecebido, setNumeroRecebido] = useState("");
  const [numeroDocFinal, setNumeroDocFinal] = useState("");
  const [reiteracoes, setReiteracoes] = useState(0);
  const [carregandoFluxo, setCarregandoFluxo] = useState(false);

  const carregarFluxo = async () => {
    if (!processoId) return;

    setCarregandoFluxo(true);
    try {
      const processoRef = doc(db, "processos", processoId);
      const snap = await getDoc(processoRef);
      if (!snap.exists()) return;

      const data = snap.data();
      const pedido = data?.pedidoSubsidios || {};
      const resposta = data?.respostaDU || {};

      setSituacaoFluxo(normalizeSituacao(pedido?.situacaoFluxo));
      setAcaoPrincipal((pedido?.acaoPrincipal as AcaoPrincipal) || "DILIGENCIA");

      const tipoDestino = (pedido?.tipoDestino || "").toString().toLowerCase();
      const tipoSalvo = (pedido?.tipoDiligencia as TipoDiligencia) || "";
      if (tipoSalvo === "INTERNO" || tipoSalvo === "EXTERNO") {
        setTipoDiligencia(tipoSalvo);
      } else {
        setTipoDiligencia(tipoDestino === "externo" ? "EXTERNO" : "INTERNO");
      }

      setDataPrazo((pedido?.dataPrazo || pedido?.prazoResposta || "").toString());
      const numeroSaidaCarregado = (pedido?.numeroSaida || pedido?.numeroDiex || resposta?.numeroDiex || "").toString();
      setNumeroSaida(numeroSaidaCarregado);
      setNumeroSaidaSalvo(!!numeroSaidaCarregado.trim());
      setNumeroRecebido((pedido?.numeroRecebido || resposta?.numeroRecebido || "").toString());
      setNumeroDocFinal((pedido?.numeroDocFinal || resposta?.numeroOficio || "").toString());
      setReiteracoes(Number(pedido?.reiteracoes || 0));
    } catch (error) {
      console.error("Erro ao carregar fluxo DU:", error);
      toast.error("Não foi possível carregar o fluxo do processo.");
    } finally {
      setCarregandoFluxo(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    carregarFluxo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, processoId]);

  const registrarHistorico = async (texto: string) => {
    const agoraISO = new Date().toISOString();

    const historicoRef = collection(db, `processos/${processoId}/historico`);
    await addDoc(historicoRef, {
      autor: autorMilitar,
      autorId: user?.uid || "sistema",
      texto,
      timestamp: agoraISO,
    });

    const mensagensRef = doc(db, "mensagens", processoId);
    const mensagensSnap = await getDoc(mensagensRef);
    const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
    await setDoc(mensagensRef, {
      historico: [
        ...historicoExistente,
        {
          id: crypto.randomUUID(),
          autor: autorMilitar,
          autorId: user?.uid || "sistema",
          texto,
          timestamp: agoraISO,
        },
      ],
    });
  };

  const atualizarComSnapshotDU = async (
    patch: Record<string, unknown>,
    dataAtual?: Record<string, unknown>,
  ) => {
    const processoRef = doc(db, "processos", processoId);
    const atual = dataAtual || ((await getDoc(processoRef)).data() as Record<string, unknown>) || {};
    const previousDoc = { ...atual };
    delete (previousDoc as Record<string, unknown>).ultimaAcaoFluxo;

    await updateDoc(processoRef, {
      ...patch,
      ultimaAcaoFluxo: {
        tipo: "DU",
        criadoEm: new Date().toISOString(),
        criadoPorNome: autorMilitar,
        previousDoc,
      },
    });
  };

  const avancarFluxo = async (
    proximaSituacao: SituacaoFluxoDU,
    extras?: {
      numeroSaida?: string;
      numeroRecebido?: string;
      numeroDocFinal?: string;
      dataPrazo?: string;
      reiteracoes?: number;
      acaoPrincipal?: AcaoPrincipal;
      tipoDiligencia?: TipoDiligencia;
      statusOverride?: string;
      descricaoOverride?: string;
      responsavelOverride?: string;
    },
  ) => {
    if (!processoId || !user) return;

    try {
      const processoRef = doc(db, "processos", processoId);
      const snap = await getDoc(processoRef);
      const dataAtual = snap.exists() ? snap.data() : {};
      const pedidoAtual = dataAtual?.pedidoSubsidios || {};
      const respostaAtual = dataAtual?.respostaDU || {};

      const numeroSaidaEfetivo = (extras?.numeroSaida ?? numeroSaida).trim();
      const numeroRecebidoEfetivo = (extras?.numeroRecebido ?? numeroRecebido).trim();
      const numeroDocFinalEfetivo = (extras?.numeroDocFinal ?? numeroDocFinal).trim();
      const dataPrazoEfetiva = (extras?.dataPrazo ?? dataPrazo).trim();
      const acaoPrincipalEfetiva = extras?.acaoPrincipal ?? acaoPrincipal;
      const tipoDiligenciaEfetiva = extras?.tipoDiligencia ?? tipoDiligencia;
      const reiteracoesEfetivas = extras?.reiteracoes ?? reiteracoes;
      const agoraISO = new Date().toISOString();

      const entrouEmAguardandoResposta = proximaSituacao === "AGUARDANDO_RESPOSTA";
      const assinaturaChefiaInterno =
        entrouEmAguardandoResposta
        && tipoDiligenciaEfetiva === "INTERNO"
        && situacaoFluxo === "CHEFIA_DILIGENCIA";
      const assinaturaChemExterno =
        entrouEmAguardandoResposta
        && tipoDiligenciaEfetiva === "EXTERNO"
        && situacaoFluxo === "AGUARDANDO_CHEM_DILIGENCIA";

      const numeroDiexHistorico = Array.from(
        new Set(
          [
            ...(Array.isArray(pedidoAtual?.numeroDiexHistorico) ? pedidoAtual.numeroDiexHistorico : []),
            pedidoAtual?.numeroDiex,
            respostaAtual?.numeroDiex,
            numeroSaidaEfetivo,
          ]
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean),
        ),
      );

      const pedidoSubsidiosPatch = {
        ...pedidoAtual,
        tipoSolicitacao: reiteracoesEfetivas > 0 ? "reiteracao" : "primeira_vez",
        tipoDestino: tipoDiligenciaEfetiva === "INTERNO" ? "interno" : "externo",
        tipoDiligencia: tipoDiligenciaEfetiva,
        acaoPrincipal: acaoPrincipalEfetiva,
        dataPrazo: dataPrazoEfetiva,
        prazoResposta: dataPrazoEfetiva,
        numeroSaida: numeroSaidaEfetivo,
        numeroRecebido: numeroRecebidoEfetivo,
        numeroDocFinal: numeroDocFinalEfetivo,
        numeroDiex: numeroSaidaEfetivo || pedidoAtual?.numeroDiex || "",
        numeroDiexHistorico,
        reiteracoes: reiteracoesEfetivas,
        situacaoFluxo: proximaSituacao,
        solicitadoEm: entrouEmAguardandoResposta ? agoraISO : (pedidoAtual?.solicitadoEm || ""),
        solicitadoPorNome: entrouEmAguardandoResposta ? autorMilitar : (pedidoAtual?.solicitadoPorNome || ""),
        assinaturaChefiaEm: assinaturaChefiaInterno ? agoraISO : (pedidoAtual?.assinaturaChefiaEm || ""),
        assinaturaChemEm: assinaturaChemExterno ? agoraISO : (pedidoAtual?.assinaturaChemEm || ""),
      };

      const respostaPatch = {
        ...respostaAtual,
        numeroDiex: numeroSaidaEfetivo || respostaAtual?.numeroDiex || "",
        numeroOficio: numeroDocFinalEfetivo || respostaAtual?.numeroOficio || "",
        numeroRecebido: numeroRecebidoEfetivo || respostaAtual?.numeroRecebido || "",
        situacao: proximaSituacao === "APTO_FINALIZAR" ? "assinada_chem" : (respostaAtual?.situacao || "fluxo_du"),
        registradoEm: new Date().toISOString(),
        registradoPorNome: autorMilitar,
      };

      const descricao = extras?.descricaoOverride || descricaoPorSituacao[proximaSituacao];
      const status = extras?.statusOverride || statusPorSituacao[proximaSituacao];

      const patchProcesso: Record<string, unknown> = {
        pedidoSubsidios: pedidoSubsidiosPatch,
        respostaDU: respostaPatch,
        status,
        descricao,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      };

      if (extras?.responsavelOverride !== undefined) {
        patchProcesso.responsavel = extras.responsavelOverride;
      }

      await atualizarComSnapshotDU(patchProcesso, dataAtual as Record<string, unknown>);

      await registrarHistorico(descricao);

      setSituacaoFluxo(proximaSituacao);
      if (extras?.reiteracoes !== undefined) setReiteracoes(extras.reiteracoes);
      if (extras?.numeroSaida !== undefined) setNumeroSaida(extras.numeroSaida);
      if (extras?.numeroRecebido !== undefined) setNumeroRecebido(extras.numeroRecebido);
      if (extras?.numeroDocFinal !== undefined) setNumeroDocFinal(extras.numeroDocFinal);
      if (extras?.dataPrazo !== undefined) setDataPrazo(extras.dataPrazo);
      if (extras?.acaoPrincipal !== undefined) setAcaoPrincipal(extras.acaoPrincipal);
      if (extras?.tipoDiligencia !== undefined) setTipoDiligencia(extras.tipoDiligencia);

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao avançar fluxo DU:", error);
      toast.error("Falha ao atualizar o fluxo DU.");
    }
  };

  const finalizarProcesso = async () => {
    if (!processoId || !user) return;

    try {
      const processoRef = doc(db, "processos", processoId);
      const descricao = "Processo finalizado no fluxo DU.";

      const snap = await getDoc(processoRef);
      const dataAtual = snap.exists() ? (snap.data() as Record<string, unknown>) : {};

      await atualizarComSnapshotDU({
        status: "concluido",
        descricao,
        finalizado: true,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      }, dataAtual);

      await registrarHistorico(descricao);
      toast.success("Processo finalizado com sucesso.");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao finalizar processo:", error);
      toast.error("Não foi possível finalizar o processo.");
    }
  };

  const cabecalhoSituacao = useMemo(() => {
    const mapa: Record<SituacaoFluxoDU, string> = {
      MESA_ASSESSOR: "Mesa do Assessor",
      CHEFIA_DILIGENCIA: "Na Chefia - Diligência",
      AGUARDANDO_CHEM_DILIGENCIA: "Aguardando CHEM - Diligência",
      AGUARDANDO_RESPOSTA: "Aguardando Resposta",
      CRIANDO_REITERACAO: "Criando Reiteração",
      CHEFIA_DEFESA: "Na Chefia - Defesa",
      AGUARDANDO_CHEM_DEFESA: "Aguardando CHEM - Defesa",
      APTO_FINALIZAR: "Apto para Finalização",
    };
    return mapa[situacaoFluxo];
  }, [situacaoFluxo]);

  const fluxoExternoPendenteRegistro =
    acaoPrincipal === "DILIGENCIA"
    && tipoDiligencia === "EXTERNO"
    && !numeroSaida.trim();

  const fluxoExternoPendenteRegistroRecebido =
    acaoPrincipal === "DILIGENCIA"
    && tipoDiligencia === "EXTERNO"
    && !!numeroSaida.trim()
    && !numeroRecebido.trim()
    && situacaoFluxo === "MESA_ASSESSOR";

  const salvarNumeroDaAssinatura = async () => {
    const numero = numeroSaida.trim();
    if (!numero || !processoId) {
      toast.error("Informe o número do documento assinado.");
      return;
    }
    try {
      const processoRef = doc(db, "processos", processoId);
      const snap = await getDoc(processoRef);
      const pedidoAtual = snap.exists() ? (snap.data()?.pedidoSubsidios || {}) : {};
      await updateDoc(processoRef, {
        "pedidoSubsidios": { ...pedidoAtual, numeroSaida: numero, numeroDiex: numero },
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });
      setNumeroSaidaSalvo(true);
      toast.success("Número registrado. Agora inicie o prazo quando estiver pronto.");
    } catch {
      toast.error("Falha ao salvar o número.");
    }
  };

  const iniciarPrazoAposRegistro = (tipo: TipoDiligencia) => {
    const numero = numeroSaida.trim();
    if (!numero) {
      toast.error("Informe o número do documento assinado.");
      return;
    }
    if (!dataPrazo.trim()) {
      toast.error("Defina o prazo para resposta antes de iniciar.");
      return;
    }
    void avancarFluxo("AGUARDANDO_RESPOSTA", {
      numeroSaida: numero,
      dataPrazo: dataPrazo.trim(),
      acaoPrincipal: "DILIGENCIA",
      tipoDiligencia: tipo,
    });
  };

  const registrarDocumentoRecebidoEEnviarDistribuicao = () => {
    const numero = numeroRecebido.trim();
    if (!numero) {
      toast.error("Informe o número do documento recebido.");
      return;
    }

    void avancarFluxo("MESA_ASSESSOR", {
      numeroRecebido: numero,
      acaoPrincipal: "DILIGENCIA",
      tipoDiligencia: "EXTERNO",
      statusOverride: "Aguardando Distribuição",
      responsavelOverride: "Sem responsável",
      descricaoOverride: "Documento externo registrado pelo assessor. Processo aguardando distribuição.",
    });
  };

  const renderRegistroNumeroAssinadoChem = () => (
    <div className="space-y-4 animate-in fade-in">
      <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 space-y-4">
        <div className="text-center">
          <FileSignature className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <h4 className="font-bold text-emerald-900 text-sm">Documento Assinado pelo CHEM</h4>
          <p className="text-xs text-emerald-700 mb-3">Insira o número de saída (DIEx Externo / Ofício):</p>
          <input
            type="text"
            aria-label="Número assinado pelo CHEM"
            value={numeroSaida}
            onChange={(e) => { setNumeroSaida(e.target.value); setNumeroSaidaSalvo(false); }}
            placeholder="Ex: Ofício nº 45/2026"
            className="w-full p-3 border rounded-lg text-center font-bold text-emerald-900 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-emerald-800 mb-1 flex items-center gap-1">
            <CalendarIcon className="w-3.5 h-3.5" />
            Prazo para Resposta
          </label>
          <input
            type="date"
            aria-label="Prazo para resposta"
            value={dataPrazo}
            onChange={(e) => setDataPrazo(e.target.value)}
            className="w-full p-2.5 border rounded-lg text-sm text-emerald-900 outline-none"
          />
          {!dataPrazo && (
            <p className="text-[11px] text-amber-600 mt-1">Nenhum prazo definido ainda. Defina antes de iniciar.</p>
          )}
        </div>
      </div>
      {/* Passo 1: Registrar o número */}
      <button
        disabled={!numeroSaida.trim() || numeroSaidaSalvo}
        onClick={() => { void salvarNumeroDaAssinatura(); }}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:bg-blue-300"
      >
        {numeroSaidaSalvo ? "✓ Número Registrado" : "Registrar Número do Documento"}
      </button>
      {/* Passo 2: Iniciar o prazo — só ativo após registrar */}
      <button
        disabled={!numeroSaidaSalvo || !dataPrazo.trim()}
        onClick={() => iniciarPrazoAposRegistro("EXTERNO")}
        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl disabled:bg-emerald-300"
      >
        Iniciar Prazo
      </button>
      <button
        onClick={finalizarProcesso}
        className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors"
      >
        Finalizar Processo
      </button>
    </div>
  );

  const renderVisaoAssessor = () => {
    switch (situacaoFluxo) {
      case "MESA_ASSESSOR":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {fluxoExternoPendenteRegistro && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h4 className="text-sm font-bold text-emerald-900">Pendência de registro do documento assinado</h4>
                <p className="mt-1 text-[11px] text-emerald-800">
                  Este fluxo externo retornou para a mesa com necessidade de registrar o número assinado pelo CHEM.
                </p>
                <div className="mt-3">{renderRegistroNumeroAssinadoChem()}</div>
              </div>
            )}

            {fluxoExternoPendenteRegistroRecebido && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h4 className="text-sm font-bold text-amber-900">Registrar Documento Recebido</h4>
                <p className="mt-1 text-[11px] text-amber-800">
                  Informe o número do documento recebido para encaminhar o processo para aguardando distribuição.
                </p>
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    aria-label="Número do documento recebido"
                    value={numeroRecebido}
                    onChange={(e) => setNumeroRecebido(e.target.value)}
                    placeholder="Ex: Ofício/DIEx recebido"
                    className="w-full p-2.5 border rounded-lg outline-none text-sm"
                  />
                  <button
                    disabled={!numeroRecebido.trim()}
                    onClick={registrarDocumentoRecebidoEEnviarDistribuicao}
                    className="w-full bg-amber-600 disabled:bg-amber-300 text-white font-bold py-2.5 rounded-xl"
                  >
                    Registrar e Enviar para Aguardando Distribuição
                  </button>
                </div>
              </div>
            )}

            {numeroRecebido && (
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-sky-900">Resposta Recebida</h4>
                  <p className="text-[11px] text-sky-700">
                    A Chefia registou o Doc: <strong>{numeroRecebido}</strong>.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-3 text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-600" /> Escolha a ação:
              </h4>
              <div className="space-y-2">
                <label className={`flex items-start gap-2 p-3 border rounded-xl cursor-pointer transition-all ${acaoPrincipal === "DILIGENCIA" ? "bg-white border-sky-400 ring-1 ring-sky-200" : "bg-transparent border-slate-200 hover:bg-white"}`}>
                  <input type="radio" name="acao-principal-du" aria-label="Pedir diligência" checked={acaoPrincipal === "DILIGENCIA"} onChange={() => setAcaoPrincipal("DILIGENCIA")} className="mt-1" />
                  <div className="w-full">
                    <p className="font-bold text-slate-800 text-sm">1. Pedir Diligência</p>
                    {acaoPrincipal === "DILIGENCIA" && (
                      <div className="mt-2 space-y-3">
                        <div className="flex gap-2">
                          <label className={`flex-1 flex items-center justify-center p-2 border rounded-md text-[11px] font-bold cursor-pointer ${tipoDiligencia === "INTERNO" ? "bg-sky-100 border-sky-300 text-sky-800" : "bg-white"}`}>
                            <input type="radio" name="tipo-diligencia-du" aria-label="Diex Simplificado" checked={tipoDiligencia === "INTERNO"} onChange={() => setTipoDiligencia("INTERNO")} className="hidden" /> Diex Simplificado
                          </label>
                          <label className={`flex-1 flex items-center justify-center p-2 border rounded-md text-[11px] font-bold cursor-pointer ${tipoDiligencia === "EXTERNO" ? "bg-sky-100 border-sky-300 text-sky-800" : "bg-white"}`}>
                            <input type="radio" name="tipo-diligencia-du" aria-label="Diligência externa" checked={tipoDiligencia === "EXTERNO"} onChange={() => setTipoDiligencia("EXTERNO")} className="hidden" /> Externo
                          </label>
                        </div>
                        <div className="relative">
                          <CalendarIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                          <input type="date" aria-label="Prazo da diligência" value={dataPrazo} onChange={(e) => setDataPrazo(e.target.value)} className="w-full pl-9 p-2 text-sm border rounded-md outline-none focus:ring-2 ring-sky-500" />
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                <label className={`flex items-start gap-2 p-3 border rounded-xl cursor-pointer transition-all ${acaoPrincipal === "DEFESA" ? "bg-white border-sky-400 ring-1 ring-sky-200" : "bg-transparent border-slate-200 hover:bg-white"}`}>
                  <input type="radio" name="acao-principal-du" aria-label="Elaborar defesa final" checked={acaoPrincipal === "DEFESA"} onChange={() => setAcaoPrincipal("DEFESA")} className="mt-1" />
                  <div>
                    <p className="font-bold text-slate-800 text-sm">2. Elaborar Defesa Final</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Enviar minuta final para aprovação.</p>
                  </div>
                </label>
              </div>
            </div>

            <button
              disabled={acaoPrincipal === "DILIGENCIA" && !dataPrazo}
              onClick={() =>
                avancarFluxo(acaoPrincipal === "DILIGENCIA" ? "CHEFIA_DILIGENCIA" : "CHEFIA_DEFESA", {
                  acaoPrincipal,
                  tipoDiligencia,
                  dataPrazo,
                  numeroRecebido: "",
                })
              }
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Enviar para a Chefia
            </button>
            <button
              onClick={finalizarProcesso}
              className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              Finalizar Processo
            </button>
          </div>
        );

      case "AGUARDANDO_CHEM_DILIGENCIA":
        return renderRegistroNumeroAssinadoChem();

      case "AGUARDANDO_RESPOSTA":
        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-200 text-center">
              <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <h4 className="font-bold text-amber-900 text-sm">Diligência em Andamento</h4>
              <p className="text-xs text-amber-700 mb-4">A aguardar resposta da secao/OM.</p>
              <button onClick={() => avancarFluxo("CRIANDO_REITERACAO")} className="w-full bg-white border border-orange-300 text-orange-700 hover:bg-orange-50 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                <Repeat className="w-3 h-3" /> Gerar Cobranca Oficial
              </button>
              <button
                onClick={finalizarProcesso}
                className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors mt-1"
              >
                Finalizar Processo
              </button>
            </div>
          </div>
        );

      case "CRIANDO_REITERACAO":
        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
              <h4 className="font-bold text-orange-900 text-sm mb-2">Cobranca de Diligência</h4>
              <p className="text-xs text-orange-800 mb-3">Novo prazo fatal para esta {reiteracoes + 1}ª cobranca:</p>
              <input type="date" aria-label="Novo prazo fatal da cobrança" value={dataPrazo} onChange={(e) => setDataPrazo(e.target.value)} className="w-full p-2 border rounded-md outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => avancarFluxo("AGUARDANDO_RESPOSTA")} className="flex-1 bg-slate-200 font-bold text-sm rounded-xl py-3">
                Cancelar
              </button>
              <button
                disabled={!dataPrazo}
                onClick={() =>
                  avancarFluxo("CHEFIA_DILIGENCIA", {
                    reiteracoes: reiteracoes + 1,
                    numeroSaida: "",
                    dataPrazo,
                  })
                }
                className="flex-1 bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3 rounded-xl text-sm"
              >
                Enviar a Chefia
              </button>
            </div>
            <button
              onClick={finalizarProcesso}
              className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              Finalizar Processo
            </button>
          </div>
        );

      case "AGUARDANDO_CHEM_DEFESA":
        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 text-center">
              <FileSignature className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-bold text-emerald-900 text-sm">Defesa Aprovada!</h4>
              <p className="text-xs text-emerald-700 mb-3">Insira o n° final assinado pelo CHEM:</p>
              <input type="text" aria-label="Número final assinado pelo CHEM" value={numeroDocFinal} onChange={(e) => setNumeroDocFinal(e.target.value)} placeholder="Ex: Oficio n° 789/2026" className="w-full p-3 border rounded-lg text-center font-bold text-emerald-900 outline-none" />
            </div>
            <button disabled={!numeroDocFinal} onClick={() => avancarFluxo("APTO_FINALIZAR", { numeroDocFinal })} className="w-full bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3 rounded-xl">
              Registar Numero
            </button>
          </div>
        );

      case "APTO_FINALIZAR":
        return (
          <div className="space-y-4 animate-in fade-in text-center">
            <div className="bg-slate-100 p-6 rounded-xl border border-slate-300">
              <Flag className="w-8 h-8 text-slate-800 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">Pronto para Finalização</h4>
            </div>
            <button onClick={finalizarProcesso} className="w-full bg-slate-900 text-white hover:bg-black font-bold py-4 rounded-xl">
              Finalizar Processo
            </button>
          </div>
        );

      default:
        return (
          <div className="bg-slate-50 p-6 rounded-xl border text-center border-dashed border-slate-300">
            <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-600 text-sm">Acesso Bloqueado</h4>
            <p className="text-[11px] text-slate-500 mt-1">A aguardar ação da Chefia ou CHEM.</p>
          </div>
        );
    }
  };

  const renderVisaoChefe = () => {
    const isReit = reiteracoes > 0;

    const devolverParaAssessorSemAcao = () => {
      void avancarFluxo("MESA_ASSESSOR", {
        acaoPrincipal: "DILIGENCIA",
        tipoDiligencia,
        numeroSaida: "",
      });
    };

    const corrigirParaExternoEEncaminharChem = () => {
      void avancarFluxo("AGUARDANDO_CHEM_DILIGENCIA", {
        acaoPrincipal: "DILIGENCIA",
        tipoDiligencia: "EXTERNO",
        numeroSaida: "",
      });
    };

    switch (situacaoFluxo) {
      case "MESA_ASSESSOR":
        if (fluxoExternoPendenteRegistro) {
          return renderRegistroNumeroAssinadoChem();
        }
        return (
          <div className="bg-slate-50 p-6 rounded-xl border text-center border-dashed border-slate-300">
            <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-600 text-sm">Sem Pendências</h4>
            <p className="text-[11px] text-slate-500 mt-1">Nada a fazer neste processo por agora.</p>
          </div>
        );

      case "CHEFIA_DILIGENCIA":
        return (
          <div className="space-y-4 animate-in fade-in">
            <div className={`p-4 rounded-xl border ${isReit ? "bg-red-50 border-red-200" : "bg-indigo-50 border-indigo-200"}`}>
              <div className="flex justify-between items-center mb-3">
                <h4 className={`font-bold text-sm ${isReit ? "text-red-900" : "text-indigo-900"}`}>
                  {isReit ? "Cobranca de Diligência" : tipoDiligencia === "INTERNO" ? "DIEx Simplificado" : "Diligência Externa"}
                </h4>
                {isReit && <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{reiteracoes}ª Reit.</span>}
              </div>

              {tipoDiligencia === "INTERNO" ? (
                <div className="space-y-3 mt-4">
                  <p className="text-[11px] text-indigo-800 mb-1">Você assina o DIEx Simplificado. Informe o número gerado:</p>
                  <label className="text-[11px] font-bold text-indigo-900 uppercase">N° do DIEx Assinado:</label>
                  <input type="text" aria-label="Número do DIEx assinado" value={numeroSaida} onChange={(e) => { setNumeroSaida(e.target.value); setNumeroSaidaSalvo(false); }} placeholder="Ex: DIEx 123/2026" className="w-full p-2.5 border rounded-lg outline-none text-sm" />
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1">Prazo para Resposta:</label>
                    <input
                      type="date"
                      aria-label="Prazo para resposta da diligência interna"
                      value={dataPrazo}
                      onChange={(e) => setDataPrazo(e.target.value)}
                      className="w-full p-2.5 border rounded-lg outline-none text-sm"
                    />
                    {!dataPrazo.trim() && (
                      <p className="mt-1 text-[11px] text-amber-700">Nenhum prazo definido ainda. Defina antes de iniciar.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-indigo-800 bg-white/50 p-2 rounded mt-2">Encaminhe este pedido para o CHEM assinar.</p>
              )}
            </div>

            {tipoDiligencia === "INTERNO" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h5 className="text-sm font-bold text-amber-900">Correção de fluxo</h5>
                <p className="mt-1 text-[11px] text-amber-800">
                  Se o assessor marcou DIEx Simplificado por engano, você pode devolver para correção ou ajustar sozinho para DIEx Externo / Ofício.
                </p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={devolverParaAssessorSemAcao}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Devolver ao Assessor
                  </button>
                  <button
                    onClick={corrigirParaExternoEEncaminharChem}
                    className="w-full rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Corrigir para Externo e Encaminhar ao CHEM
                  </button>
                </div>
              </div>
            )}

            {tipoDiligencia === "INTERNO" ? (
              <div className="space-y-2">
                <button
                  disabled={!numeroSaida.trim() || numeroSaidaSalvo}
                  onClick={() => { void salvarNumeroDaAssinatura(); }}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl text-sm"
                >
                  {numeroSaidaSalvo ? "✓ Número Registrado" : "Registrar Número do DIEx"}
                </button>
                <button
                  disabled={!numeroSaidaSalvo || !dataPrazo.trim()}
                  onClick={() => iniciarPrazoAposRegistro("INTERNO")}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl text-sm"
                >
                  Iniciar Prazo
                </button>
              </div>
            ) : (
              <button
                onClick={() =>
                  avancarFluxo("AGUARDANDO_CHEM_DILIGENCIA", {
                    numeroSaida,
                  })
                }
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl text-sm"
              >
                Aprovar e Encaminhar
              </button>
            )}
            <button
              onClick={finalizarProcesso}
              className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              Finalizar Processo
            </button>
          </div>
        );

      case "AGUARDANDO_CHEM_DILIGENCIA":
        return renderRegistroNumeroAssinadoChem();

      case "AGUARDANDO_RESPOSTA":
        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <h4 className="font-bold text-amber-900 text-sm mb-3 flex items-center gap-2">
                <Inbox className="w-4 h-4" /> Entrada de Resposta
              </h4>
              <p className="text-[11px] text-amber-800">
                Devolva ao assessor para que ele registre o número do documento recebido e encaminhe para aguardando distribuição.
              </p>
            </div>
            <button
              onClick={() => avancarFluxo("MESA_ASSESSOR")}
              className="w-full bg-amber-600 disabled:bg-amber-300 text-white font-bold py-3 rounded-xl flex justify-center gap-2 text-sm"
            >
              <ArrowRightCircle className="w-4 h-4" /> Devolver ao Assessor
            </button>
            <button
              onClick={finalizarProcesso}
              className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              Finalizar Processo
            </button>
          </div>
        );

      case "CHEFIA_DEFESA":
        return (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
              <h4 className="font-bold text-indigo-900 text-sm mb-2">Revisao de Defesa Final</h4>
              <p className="text-xs text-indigo-800">Aprove o envio da minuta para o CHEM.</p>
            </div>
            <button onClick={() => avancarFluxo("AGUARDANDO_CHEM_DEFESA")} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl">
              Aprovar e Encaminhar
            </button>            <button
              onClick={finalizarProcesso}
              className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-xl transition-colors"
            >
              Finalizar Processo
            </button>          </div>
        );

      default:
        return (
          <div className="bg-slate-50 p-6 rounded-xl border text-center border-dashed border-slate-300">
            <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h4 className="font-bold text-slate-600 text-sm">Sem Pendências</h4>
            <p className="text-[11px] text-slate-500 mt-1">Nada a fazer neste processo por agora.</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações DU - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">Fluxo inteligente de tramitação da Defesa da União.</DialogDescription>
        </DialogHeader>

        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <strong>Situação atual:</strong> {cabecalhoSituacao}
        </div>

        {carregandoFluxo ? (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-sm text-slate-600">
            Carregando ações do processo...
          </div>
        ) : (
          ehChefia ? renderVisaoChefe() : renderVisaoAssessor()
        )}
      </DialogContent>
    </Dialog>
  );
}
