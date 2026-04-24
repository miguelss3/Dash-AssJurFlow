import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calcularFaixasProrrogacaoPA, calcularPrazoFinalPA, formatarData, obterRegraPrazoPA } from "@/lib/prazo";
import { toast } from "sonner";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_PA_FLOW_ACTIONS,
  normalizarPAFlowActions,
  type PAFlowActionSetting,
  type SiteSettings,
} from "@/types/siteSettings";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  FileBadge,
  FileText,
  History,
  Landmark,
  PenTool,
  PlusCircle,
  Scale,
  Send,
  ShieldCheck,
  Timer,
  User,
  Users,
} from "lucide-react";

type RolePA = "assessor_pa" | "chefe_assjur";

type SituacaoFluxoPA =
  | "MESA_ASSESSOR_NOVO"
  | "AGUARDANDO_CHEFIA"
  | "AGUARDANDO_PRAZO"
  | "EM_CURSO"
  | "AGUARDANDO_CHEFIA_SOLUCAO"
  | "APTO_FINALIZAR"
  | "C_MEMORIA"
  | "C_PORTARIA"
  | "C_EM_CURSO"
  | "C_DECISAO_AUT_NOMEANTE"
  | "C_INTIMACAO_ACUSADO"
  | "C_ENCAMINHAMENTO_CMTEX"
  | "C_DECISAO_CMTEX"
  | "CONCLUIDO";

type ProrrogacaoItem = {
  dias: number;
  doc: string;
  inicio?: string;
  fim?: string;
  em: string;
  por?: string;
};

type ProcessoPA = {
  tipoPA?: string;
  situacaoFluxo?: SituacaoFluxoPA;
  encarregado?: string;
  primeiraPortaria?: string;
  numeroProcesso?: string;
  parte?: string;
  cliente?: string;
  interessado?: string;
  presidenteConselhoPosto?: string;
  presidenteConselhoNome?: string;
  omPresidenteConselho?: string;
  dataAssinatura?: string;
  dataInicioPrazo?: string;
  despachoFinal?: string;
  prorrogacoes?: ProrrogacaoItem[];
  substituicaoEncarregado?: {
    novoEncarregado?: string;
    novaPortaria?: string;
    motivo?: string;
    registradoEm?: string;
    registradoPorNome?: string;
  };
  decisaoAutNomeante?: string;
  numeroDIExRemessa?: string;
  resultadoFinalConselho?: string;
  teveRecurso?: boolean;
  membrosConselho?: string;
};

interface AcoesPAModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  siteSettings?: SiteSettings;
  onSuccess?: () => void;
}

export function AcoesPAModalNovo({ open, onOpenChange, processoId, numeroProcesso, siteSettings, onSuccess }: AcoesPAModalNovoProps) {
  const { user } = useAuth();
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;
  const autorId = user?.uid || "sistema";
  const role: RolePA = isAdmin(user) ? "chefe_assjur" : "assessor_pa";

  const [carregando, setCarregando] = useState(false);
  const [processo, setProcesso] = useState<ProcessoPA | null>(null);

  // Estado do fluxo persistido
  const [situacaoFluxo, setSituacaoFluxo] = useState<SituacaoFluxoPA>("MESA_ASSESSOR_NOVO");

  // Campos persistidos
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [dataInicioPrazo, setDataInicioPrazo] = useState("");
  const [despachoFinal, setDespachoFinal] = useState("");
  const [historicoProrrogacoes, setHistoricoProrrogacoes] = useState<ProrrogacaoItem[]>([]);
  const [novoEncarregado, setNovoEncarregado] = useState("");
  const [novaPortaria, setNovaPortaria] = useState("");
  const [motivoSubstituicao, setMotivoSubstituicao] = useState("");
  const [membrosConselho, setMembrosConselho] = useState("");
  const [decisaoAutNomeante, setDecisaoAutNomeante] = useState("");
  const [numeroDIExRemessa, setNumeroDIExRemessa] = useState("");
  const [resultadoFinalConselho, setResultadoFinalConselho] = useState("");
  const [teveRecurso, setTeveRecurso] = useState(false);

  // Campos de interface transitórios
  const [isSubstituindo, setIsSubstituindo] = useState(false);
  const [isProrrogando, setIsProrrogando] = useState(false);
  const [docProrrogacao, setDocProrrogacao] = useState("");

  const resetFormularios = () => {
    setDataAssinatura("");
    setDataInicioPrazo("");
    setDespachoFinal("");
    setHistoricoProrrogacoes([]);
    setNovoEncarregado("");
    setNovaPortaria("");
    setMotivoSubstituicao("");
    setMembrosConselho("");
    setDecisaoAutNomeante("");
    setNumeroDIExRemessa("");
    setResultadoFinalConselho("");
    setTeveRecurso(false);
    setIsSubstituindo(false);
    setIsProrrogando(false);
    setDocProrrogacao("");
  };

  // Helper para pegar o valor correto, ignorando strings vazias e undefined
  const obterValorData = (estadoLocal: string, processoField?: string): string => {
    const local = estadoLocal?.trim();
    const procValue = processoField?.trim?.();
    if (local) return local;
    if (procValue) return procValue;
    return "";
  };

  const tipoProcesso = processo?.tipoPA || "";
  const isConselho = tipoProcesso === "Conselho de Disciplina" || tipoProcesso === "Conselho de Justificação";
  const { diasIniciais, diasProrrogacao } = obterRegraPrazoPA(tipoProcesso, siteSettings);
  const fluxoAtual = isConselho ? "conselho" : "padrao";

  const acoesFluxoPA = useMemo(
    () => normalizarPAFlowActions(siteSettings?.paFlowActions, DEFAULT_PA_FLOW_ACTIONS),
    [siteSettings?.paFlowActions],
  );

  const resolverAcaoConfigurada = (actionId: string): PAFlowActionSetting | undefined => {
    return acoesFluxoPA.find((item) => {
      if (item.id !== actionId) return false;
      if (!item.enabled) return false;
      if (item.fromState !== situacaoFluxo) return false;
      if (item.role !== "ambos" && item.role !== role) return false;
      if (item.track !== "todos" && item.track !== fluxoAtual) return false;
      return true;
    });
  };

  const proximaSituacaoConfigurada = (actionId: string, fallback: SituacaoFluxoPA): SituacaoFluxoPA => {
    const acao = resolverAcaoConfigurada(actionId);
    return (acao?.toState as SituacaoFluxoPA | undefined) || fallback;
  };

  const labelAcaoConfigurada = (actionId: string, fallback: string): string => {
    const acao = resolverAcaoConfigurada(actionId);
    return acao?.label || fallback;
  };

  const renderAcoesCustomizadas = (idsPadrao: string[]) => {
    const idsPadraoSet = new Set(idsPadrao);
    const extras = acoesFluxoPA
      .filter((acao) => {
        if (!acao.enabled) return false;
        if (idsPadraoSet.has(acao.id)) return false;
        if (acao.fromState !== situacaoFluxo) return false;
        if (acao.role !== "ambos" && acao.role !== role) return false;
        if (acao.track !== "todos" && acao.track !== fluxoAtual) return false;
        return true;
      })
      .sort((a, b) => a.order - b.order);

    if (extras.length === 0) return null;

    return (
      <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Ações extras configuradas</p>
        {extras.map((acao) => (
          <Button
            key={acao.id}
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              void avancarFluxo(
                acao.toState as SituacaoFluxoPA,
                `${acao.label} (fluxo configurável).`,
              );
            }}
          >
            {acao.label}
          </Button>
        ))}
      </div>
    );
  };

  const calcularCamposPrazo = (overrides?: {
    dataInicioPrazo?: string;
    dataAssinatura?: string;
    prorrogacoes?: ProrrogacaoItem[];
  }) => {
    const prazoFinal = calcularPrazoFinalPA({
      tipoPA: tipoProcesso,
      dataInicioPrazo: overrides?.dataInicioPrazo ?? dataInicioPrazo,
      dataAssinatura: overrides?.dataAssinatura ?? dataAssinatura,
      prorrogacoes: overrides?.prorrogacoes ?? historicoProrrogacoes,
    }, siteSettings);

    return prazoFinal ? { prazoFatal: prazoFinal, finalPrazo: prazoFinal } : {};
  };

  const encarregadoAtual = useMemo(() => {
    if (!processo) return "Não definido";
    if (isConselho) {
      const posto = processo.presidenteConselhoPosto || "";
      const nome = processo.presidenteConselhoNome || "";
      const composto = `${posto} ${nome}`.trim();
      return composto || processo.encarregado || "Não definido";
    }
    return processo.encarregado || "Não definido";
  }, [processo, isConselho]);

  const numeroPortaria = processo?.primeiraPortaria || processo?.numeroProcesso || numeroProcesso || "Não definida";
  const interessadoAcusado = processo?.interessado || processo?.parte || processo?.cliente || "Não definido";

  const estadoInicial = (proc: ProcessoPA): SituacaoFluxoPA => {
    if (proc.situacaoFluxo) return proc.situacaoFluxo;
    if (proc.tipoPA === "Conselho de Disciplina" || proc.tipoPA === "Conselho de Justificação") {
      return "C_MEMORIA";
    }
    return "MESA_ASSESSOR_NOVO";
  };

  const carregarProcesso = async () => {
    if (!processoId || !open) return;
    setCarregando(true);
    try {
      const processoRef = doc(db, "processos", processoId);
      const snap = await getDoc(processoRef);
      if (!snap.exists()) {
        toast.error("Processo não encontrado.");
        return;
      }

      const data = snap.data() as ProcessoPA;
      setProcesso(data);
      setSituacaoFluxo(estadoInicial(data));
      setDataAssinatura(data.dataAssinatura || "");
      setDataInicioPrazo(data.dataInicioPrazo || "");
      setDespachoFinal(data.despachoFinal || "");
      setHistoricoProrrogacoes(Array.isArray(data.prorrogacoes) ? data.prorrogacoes : []);
      setMembrosConselho(data.membrosConselho || "");
      setDecisaoAutNomeante(data.decisaoAutNomeante || "");
      setNumeroDIExRemessa(data.numeroDIExRemessa || "");
      setResultadoFinalConselho(data.resultadoFinalConselho || "");
      setTeveRecurso(data.teveRecurso === true);

      // Verifica se há prorrogações e se o prazo precisa ser recalculado
      const prorrogacoes = Array.isArray(data.prorrogacoes) ? data.prorrogacoes : [];
      if (prorrogacoes.length > 0) {
        const dataInicio = data.dataInicioPrazo || "";
        const dataAssin = data.dataAssinatura || "";
        
        const prazoCalculado = calcularPrazoFinalPA({
          tipoPA: data.tipoPA,
          dataInicioPrazo: dataInicio,
          dataAssinatura: dataAssin,
          prorrogacoes,
        }, siteSettings);

        // Se o prazo calculado é diferente do que está no banco, atualiza
        if (prazoCalculado && (data.prazoFatal !== prazoCalculado || data.finalPrazo !== prazoCalculado)) {
          try {
            await updateDoc(processoRef, {
              prazoFatal: prazoCalculado,
              finalPrazo: prazoCalculado,
              atualizadoEm: Timestamp.now(),
            });
            // Atualiza o estado local com o novo prazo
            setProcesso({
              ...data,
              prazoFatal: prazoCalculado,
              finalPrazo: prazoCalculado,
            });
          } catch (updateError) {
            console.warn("Não foi possível atualizar prazo recalculado:", updateError);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar processo PA:", error);
      toast.error("Não foi possível carregar o fluxo do PA.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!open) {
      resetFormularios();
      return;
    }
    carregarProcesso();
  }, [open, processoId]);

  const registrarHistorico = async (texto: string) => {
    const agoraISO = new Date().toISOString();

    const historicoRef = collection(db, `processos/${processoId}/historico`);
    await addDoc(historicoRef, {
      autor: autorMilitar,
      autorId,
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
          autorId,
          texto,
          timestamp: agoraISO,
        },
      ],
    });
  };

  const atualizarComSnapshotPA = async (patch: Record<string, unknown>) => {
    const processoRef = doc(db, "processos", processoId);
    const snap = await getDoc(processoRef);
    const dataAtual = snap.exists() ? (snap.data() as Record<string, unknown>) : {};
    const previousDoc = { ...dataAtual };
    delete (previousDoc as Record<string, unknown>).ultimaAcaoFluxo;

    await updateDoc(processoRef, {
      ...patch,
      ultimaAcaoFluxo: {
        tipo: "PA",
        criadoEm: new Date().toISOString(),
        criadoPorNome: autorMilitar,
        previousDoc,
      },
    });
  };

  const avancarFluxo = async (
    novaSituacao: SituacaoFluxoPA,
    descricao: string,
    extra: Record<string, unknown> = {},
  ) => {
    if (!processoId || !user) return;
    try {
      const patch: Record<string, unknown> = {
        situacaoFluxo: novaSituacao,
        descricao,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        ...extra,
      };

      if (novaSituacao === "CONCLUIDO") {
        patch.status = "concluido";
        patch.finalizado = true;
      } else {
        patch.status = "andamento";
        patch.finalizado = false;
      }

      // Compatibilidade com flags antigas, agora guiadas pela máquina de estado
      if (novaSituacao === "AGUARDANDO_CHEFIA") {
        patch.aguardandoAssinaturaCmt = true;
      }
      if (novaSituacao === "AGUARDANDO_PRAZO") {
        patch.aguardandoAssinaturaCmt = false;
      }

      await atualizarComSnapshotPA(patch);
      await registrarHistorico(descricao);
      setSituacaoFluxo(novaSituacao);
      if (onSuccess) onSuccess();
      toast.success("Fluxo PA atualizado.");
    } catch (error) {
      console.error("Erro ao avançar fluxo PA:", error);
      toast.error("Falha ao atualizar o fluxo PA.");
    }
  };

  const salvarSubstituicao = async () => {
    if (!novoEncarregado.trim() || !novaPortaria.trim()) {
      toast.error("Informe novo encarregado e nova portaria.");
      return;
    }
    try {
      const agoraISO = new Date().toISOString();
      
      // Usa função helper para garantir que os valores estão corretos (ignora strings vazias)
      const dataInicioParaCalculo = obterValorData(dataInicioPrazo, processo?.dataInicioPrazo);
      const dataAssinaturaParaCalculo = obterValorData(dataAssinatura, processo?.dataAssinatura);
      
      const prazoCalculado = calcularPrazoFinalPA({
        tipoPA: tipoProcesso,
        dataInicioPrazo: dataInicioParaCalculo,
        dataAssinatura: dataAssinaturaParaCalculo,
        prorrogacoes: historicoProrrogacoes,
      }, siteSettings);
      
      const camposPrazoCalculados = prazoCalculado ? { prazoFatal: prazoCalculado, finalPrazo: prazoCalculado } : {};
      
      await atualizarComSnapshotPA({
        encarregado: novoEncarregado.trim(),
        substituicaoEncarregado: {
          novoEncarregado: novoEncarregado.trim(),
          novaPortaria: novaPortaria.trim(),
          motivo: motivoSubstituicao.trim(),
          registradoEm: agoraISO,
          registradoPorNome: autorMilitar,
        },
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        descricao: `Substituição de encarregado registrada: ${novoEncarregado.trim()} (${novaPortaria.trim()}).`,
        ...camposPrazoCalculados,
      });
      await registrarHistorico(`Substituição de encarregado: ${novoEncarregado.trim()} - ${novaPortaria.trim()}.`);
      setIsSubstituindo(false);
      setNovoEncarregado("");
      setNovaPortaria("");
      setMotivoSubstituicao("");
      if (onSuccess) onSuccess();
      toast.success("Substituição registrada.");
    } catch (error) {
      console.error("Erro ao registrar substituição:", error);
      toast.error("Não foi possível registrar a substituição.");
    }
  };

  const salvarProrrogacao = async () => {
    if (!docProrrogacao.trim()) {
      toast.error("Informe o documento de prorrogação.");
      return;
    }
    try {
      const item: ProrrogacaoItem = {
        dias: diasProrrogacao,
        doc: docProrrogacao.trim(),
        em: new Date().toISOString(),
        por: autorMilitar,
      };
      const novasProrrogacoes = [...historicoProrrogacoes, item];
      
      // Usa função helper para garantir que os valores estão corretos (ignora strings vazias)
      const dataInicioParaCalculo = obterValorData(dataInicioPrazo, processo?.dataInicioPrazo);
      const dataAssinaturaParaCalculo = obterValorData(dataAssinatura, processo?.dataAssinatura);
      
      const faixasProrrogacao = calcularFaixasProrrogacaoPA({
        tipoPA: tipoProcesso,
        dataInicioPrazo: dataInicioParaCalculo,
        dataAssinatura: dataAssinaturaParaCalculo,
        prorrogacoes: novasProrrogacoes,
      }, siteSettings);

      const novasProrrogacoesComFaixa = novasProrrogacoes.map((prorrogacao, index) => ({
        ...prorrogacao,
        inicio: faixasProrrogacao[index]?.inicio || prorrogacao.inicio,
        fim: faixasProrrogacao[index]?.fim || prorrogacao.fim,
      }));

      const prazoCalculado = calcularPrazoFinalPA({
        tipoPA: tipoProcesso,
        dataInicioPrazo: dataInicioParaCalculo,
        dataAssinatura: dataAssinaturaParaCalculo,
        prorrogacoes: novasProrrogacoesComFaixa,
      }, siteSettings);
      
      const camposPrazoCalculados = prazoCalculado ? { prazoFatal: prazoCalculado, finalPrazo: prazoCalculado } : {};
      
      await atualizarComSnapshotPA({
        prorrogacoes: novasProrrogacoesComFaixa,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        descricao: `Prazo prorrogado em +${diasProrrogacao} dias (${item.doc}).`,
        ...camposPrazoCalculados,
      });
      await registrarHistorico(`Prorrogação registrada: +${diasProrrogacao} dias (${item.doc}).`);
      setHistoricoProrrogacoes(novasProrrogacoesComFaixa);
      setDocProrrogacao("");
      setIsProrrogando(false);
      if (onSuccess) onSuccess();
      toast.success(`Prorrogação de +${diasProrrogacao} dias registrada.`);
    } catch (error) {
      console.error("Erro ao registrar prorrogação:", error);
      toast.error("Não foi possível registrar a prorrogação.");
    }
  };

  const iniciarPrazoPadrao = () => {
    const dataInicioParaCalculo = obterValorData(dataInicioPrazo, processo?.dataInicioPrazo);
    const dataAssinaturaParaCalculo = obterValorData(dataAssinatura, processo?.dataAssinatura);
    
    const prazoCalculado = calcularPrazoFinalPA({
      tipoPA: tipoProcesso,
      dataInicioPrazo: dataInicioParaCalculo,
      dataAssinatura: dataAssinaturaParaCalculo,
      prorrogacoes: historicoProrrogacoes,
    }, siteSettings);
    
    const camposPrazoCalculados = prazoCalculado ? { prazoFatal: prazoCalculado, finalPrazo: prazoCalculado } : {};
    
    void avancarFluxo(
      proximaSituacaoConfigurada("PA_INICIAR_PRAZO", "EM_CURSO"),
      `Prazo do PA iniciado em ${formatarData(dataInicioParaCalculo)}.`,
      {
        dataInicioPrazo: dataInicioParaCalculo,
        ...camposPrazoCalculados,
      },
    );
  };

  const confirmarInstalacaoConselho = () => {
    const dataAssinaturaParaCalculo = obterValorData(dataAssinatura, processo?.dataAssinatura);
    
    const prazoCalculado = calcularPrazoFinalPA({
      tipoPA: tipoProcesso,
      dataInicioPrazo: dataAssinaturaParaCalculo,
      dataAssinatura: dataAssinaturaParaCalculo,
      prorrogacoes: historicoProrrogacoes,
    }, siteSettings);
    
    const camposPrazoCalculados = prazoCalculado ? { prazoFatal: prazoCalculado, finalPrazo: prazoCalculado } : {};
    
    void avancarFluxo(proximaSituacaoConfigurada("C_CHEFIA_ASSINA_PORTARIA", "C_EM_CURSO"), "Portaria assinada e Conselho instalado.", {
      dataAssinatura: dataAssinaturaParaCalculo,
      dataInicioPrazo: dataAssinaturaParaCalculo,
      ...camposPrazoCalculados,
    });
  };

  const cabecalhoReadOnly = (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm">
      <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-sky-700" /> Dados do Processo (Somente Leitura)
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase font-bold text-slate-500">Portaria</p>
          <p className="font-semibold text-slate-800">{numeroPortaria}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <p className="text-[10px] uppercase font-bold text-slate-500">Encarregado/Presidente</p>
          <p className="font-semibold text-slate-800">{encarregadoAtual}</p>
        </div>
        {isConselho && (
          <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 sm:col-span-2">
            <p className="text-[10px] uppercase font-bold text-slate-500">Acusado/Interessado</p>
            <p className="font-semibold text-slate-800">{interessadoAcusado}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderVisaoAssessorConselho = () => {
    switch (situacaoFluxo) {
      case "C_MEMORIA":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {cabecalhoReadOnly}
            <Button
              onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_ENVIAR_MEMORIA", "C_PORTARIA"), "Memória elaborada e enviada à chefia para assinatura da portaria.")}
              className="w-full bg-rose-600 hover:bg-rose-700"
            >
              {labelAcaoConfigurada("C_ENVIAR_MEMORIA", "Elaborar Memória e Enviar à Chefia")}
            </Button>
            {renderAcoesCustomizadas(["C_ENVIAR_MEMORIA"])}
          </div>
        );

      case "C_EM_CURSO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {historicoProrrogacoes.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-3">
                <History className="w-5 h-5 text-rose-600 mt-0.5" />
                <div className="w-full">
                  <h4 className="text-sm font-bold text-rose-900">Prorrogações ({historicoProrrogacoes.length})</h4>
                  <ul className="mt-1 space-y-1">
                    {historicoProrrogacoes.map((p, i) => (
                      <li key={`${p.doc}-${i}`} className="text-[11px] bg-white text-rose-800 px-2 py-1 rounded border border-rose-100 flex justify-between">
                        <span>{p.doc} {p.inicio && p.fim ? `(${formatarData(p.inicio)} a ${formatarData(p.fim)})` : ""}</span>
                        <span className="font-bold">+{p.dias}d</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isProrrogando ? (
              <div className="space-y-3 bg-rose-50 p-4 rounded-xl border border-rose-200">
                <h4 className="font-bold text-rose-900 flex items-center gap-2"><Timer className="w-4 h-4" /> Registrar Prorrogação</h4>
                <div className="text-sm bg-rose-100 border border-rose-300 text-rose-900 rounded-lg px-3 py-2 font-semibold">+{diasProrrogacao} dias (padrão legal)</div>
                <Input value={docProrrogacao} onChange={(e) => setDocProrrogacao(e.target.value)} placeholder="Documento concessório" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsProrrogando(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-rose-600 hover:bg-rose-700" onClick={salvarProrrogacao}>Registar +{diasProrrogacao} dias</Button>
                </div>
              </div>
            ) : (
              <div className="bg-sky-50 p-5 rounded-xl border border-sky-200">
                <h4 className="font-bold text-sky-900 flex items-center gap-2 mb-2"><Users className="w-5 h-5" /> Conselho em Curso</h4>
                <p className="text-sm text-sky-800 mb-3">Prazo legal inicial: {diasIniciais} dias.</p>
                <Button variant="outline" className="w-full border-rose-300 text-rose-700" onClick={() => setIsProrrogando(true)}>
                  <PlusCircle className="w-4 h-4 mr-1" /> Prorrogar Prazo (+{diasProrrogacao}d)
                </Button>
              </div>
            )}

            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_ENVIAR_DECISAO_AUT", "C_DECISAO_AUT_NOMEANTE"), "Conselho concluído e remetido para decisão da autoridade nomeante.")} className="w-full bg-slate-800 hover:bg-black">
              <PenTool className="w-4 h-4 mr-1" /> Enviar p/ Decisão da Autoridade
            </Button>
            {renderAcoesCustomizadas(["C_ENVIAR_DECISAO_AUT"])}
          </div>
        );

      case "C_INTIMACAO_ACUSADO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
              <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-3"><Scale className="w-5 h-5" /> Intimação e Recurso</h4>
              <p className="text-sm text-amber-800 mb-4">O acusado apresentou recurso no prazo legal?</p>
              <div className="bg-white p-3 rounded-lg border border-amber-100 text-xs text-slate-600">
                <strong className="text-amber-900 block mb-1">Decisão Exarada:</strong>
                {decisaoAutNomeante || "Sem decisão registrada."}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => {
                setTeveRecurso(true);
                void avancarFluxo(proximaSituacaoConfigurada("C_RECURSO_SIM", "C_ENCAMINHAMENTO_CMTEX"), "Recurso do acusado recebido. Encaminhar ao Cmt Ex.", { teveRecurso: true });
              }}>
                <FileText className="w-4 h-4 mr-1" /> {labelAcaoConfigurada("C_RECURSO_SIM", "Sim, apresentou recurso")}
              </Button>
              <Button className="w-full bg-slate-900 hover:bg-black" onClick={() => {
                setTeveRecurso(false);
                setResultadoFinalConselho("Transitou em Julgado - Sem Recurso");
                void avancarFluxo(proximaSituacaoConfigurada("C_RECURSO_NAO", "CONCLUIDO"), "Conselho encerrado sem recurso do acusado.", {
                  teveRecurso: false,
                  resultadoFinalConselho: "Transitou em Julgado - Sem Recurso",
                });
              }}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> {labelAcaoConfigurada("C_RECURSO_NAO", "Não apresentou recurso (finalizar)")}
              </Button>
            </div>
            {renderAcoesCustomizadas(["C_RECURSO_SIM", "C_RECURSO_NAO"])}
          </div>
        );

      case "C_ENCAMINHAMENTO_CMTEX":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
              <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-2"><Send className="w-5 h-5" /> Encaminhamento ao Cmt Ex</h4>
              <Label htmlFor="dieg-remessa" className="text-[11px] uppercase text-amber-900">Nº DIEx/Ofício de Remessa</Label>
              <Input id="dieg-remessa" value={numeroDIExRemessa} onChange={(e) => setNumeroDIExRemessa(e.target.value)} className="mt-1" />
            </div>
            <Button disabled={!numeroDIExRemessa.trim()} onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_CONFIRMAR_REMESSA", "C_DECISAO_CMTEX"), "Remessa ao Cmt Ex confirmada.", { numeroDIExRemessa: numeroDIExRemessa.trim(), teveRecurso: true })} className="w-full bg-amber-600 hover:bg-amber-700">
              {labelAcaoConfigurada("C_CONFIRMAR_REMESSA", "Confirmar Remessa ao Cmt Ex")}
            </Button>
            {renderAcoesCustomizadas(["C_CONFIRMAR_REMESSA"])}
          </div>
        );

      default:
        return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação da Chefia.</div>;
    }
  };

  const renderVisaoChefeConselho = () => {
    switch (situacaoFluxo) {
      case "C_PORTARIA":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {cabecalhoReadOnly}
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
              <h4 className="font-bold text-indigo-900 text-sm mb-2 flex items-center gap-2"><FileBadge className="w-4 h-4" /> Portaria de Instauração</h4>
              <Label htmlFor="assinatura-chefia-conselho">Data da Assinatura</Label>
              <Input id="assinatura-chefia-conselho" type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} className="mt-1" />
            </div>
            <Button disabled={!dataAssinatura} onClick={confirmarInstalacaoConselho} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {labelAcaoConfigurada("C_CHEFIA_ASSINA_PORTARIA", "Confirmar Assinatura e Instalar")}
            </Button>
            {renderAcoesCustomizadas(["C_CHEFIA_ASSINA_PORTARIA"])}
          </div>
        );

      case "C_DECISAO_AUT_NOMEANTE":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
              <h4 className="font-bold text-indigo-900 text-sm mb-2 flex items-center gap-2"><Scale className="w-4 h-4" /> Decisão da Autoridade Nomeante</h4>
              <Textarea value={decisaoAutNomeante} onChange={(e) => setDecisaoAutNomeante(e.target.value)} rows={4} />
            </div>
            <Button disabled={!decisaoAutNomeante.trim()} onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_AUT_NOMEANTE_DECIDE", "C_INTIMACAO_ACUSADO"), "Decisão da autoridade nomeante registrada e devolvida ao assessor.", { decisaoAutNomeante: decisaoAutNomeante.trim() })} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {labelAcaoConfigurada("C_AUT_NOMEANTE_DECIDE", "Exarar Decisão e Devolver ao Assessor")}
            </Button>
            {renderAcoesCustomizadas(["C_AUT_NOMEANTE_DECIDE"])}
          </div>
        );

      case "C_DECISAO_CMTEX":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
              <h4 className="font-bold text-rose-900 text-sm mb-2 flex items-center gap-2"><Landmark className="w-4 h-4" /> Decisão Final (Cmt Ex)</h4>
              <select
                value={resultadoFinalConselho}
                onChange={(e) => setResultadoFinalConselho(e.target.value)}
                className="w-full p-3 border border-rose-300 rounded-lg text-sm bg-white"
              >
                <option value="">Selecione a decisão...</option>
                <option value="Exclusão a Bem da Disciplina da Força">Exclusão a Bem da Disciplina da Força</option>
                <option value="Reforma Administrativa Disciplinar">Reforma Administrativa Disciplinar</option>
                <option value="Arquivamento (Absolvição/Justificação)">Arquivamento (Absolvição/Justificação)</option>
              </select>
            </div>
            <Button disabled={!resultadoFinalConselho} onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_REGISTRAR_DECISAO_FINAL", "CONCLUIDO"), "Decisão final do Cmt Ex registrada e Conselho encerrado.", { resultadoFinalConselho, teveRecurso })} className="w-full bg-rose-700 hover:bg-rose-800">
              {labelAcaoConfigurada("C_REGISTRAR_DECISAO_FINAL", "Registar Decisão Final e Encerrar")}
            </Button>
            {renderAcoesCustomizadas(["C_REGISTRAR_DECISAO_FINAL"])}
          </div>
        );

      default:
        return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação do Assessor.</div>;
    }
  };

  const renderVisaoAssessorPadrao = () => {
    switch (situacaoFluxo) {
      case "MESA_ASSESSOR_NOVO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {cabecalhoReadOnly}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Send className="w-5 h-5 text-sky-600" /> Passo 1: Enviar Portaria</h4>
              <p className="text-sm text-slate-600">Encaminha para validação e assinatura da chefia da AssJur.</p>
            </div>
            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_ENVIAR_CHEFIA", "AGUARDANDO_CHEFIA"), "Processo PA enviado à chefia para assinatura da portaria.")} className="w-full bg-sky-600 hover:bg-sky-700">
              {labelAcaoConfigurada("PA_ENVIAR_CHEFIA", "Enviar para a Chefia da AssJur")}
            </Button>
            {renderAcoesCustomizadas(["PA_ENVIAR_CHEFIA"])}
          </div>
        );

      case "AGUARDANDO_PRAZO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
              <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2"><FileBadge className="w-5 h-5" /> Portaria assinada</h4>
              <Label htmlFor="inicio-prazo-pa">Data de início do prazo</Label>
              <Input id="inicio-prazo-pa" type="date" value={dataInicioPrazo} onChange={(e) => setDataInicioPrazo(e.target.value)} className="mt-1" />
              <p className="text-xs text-emerald-700 mt-2">Prazo legal inicial: {diasIniciais} dias.</p>
            </div>
            <Button disabled={!dataInicioPrazo} onClick={iniciarPrazoPadrao} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {labelAcaoConfigurada("PA_INICIAR_PRAZO", "Confirmar Data e Iniciar Prazo")}
            </Button>
            {renderAcoesCustomizadas(["PA_INICIAR_PRAZO"])}
          </div>
        );

      case "EM_CURSO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {historicoProrrogacoes.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-3">
                <History className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="w-full">
                  <h4 className="text-sm font-bold text-amber-900">Prorrogações ({historicoProrrogacoes.length})</h4>
                  <ul className="mt-1 space-y-1">
                    {historicoProrrogacoes.map((p, i) => (
                      <li key={`${p.doc}-${i}`} className="text-[11px] bg-white text-amber-800 px-2 py-1 rounded border border-amber-100 flex justify-between">
                        <span>{p.doc} {p.inicio && p.fim ? `(${formatarData(p.inicio)} a ${formatarData(p.fim)})` : ""}</span>
                        <span className="font-bold">+{p.dias}d</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isProrrogando && (
              <div className="space-y-3 bg-amber-50 p-4 rounded-xl border border-amber-200">
                <h4 className="font-bold text-amber-900 flex items-center gap-2"><Timer className="w-4 h-4" /> Registrar Prorrogação</h4>
                <div className="text-sm bg-amber-100 border border-amber-300 text-amber-900 rounded-lg px-3 py-2 font-semibold">+{diasProrrogacao} dias (padrão legal)</div>
                <Input value={docProrrogacao} onChange={(e) => setDocProrrogacao(e.target.value)} placeholder="Documento concessório" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsProrrogando(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-amber-600 hover:bg-amber-700" onClick={salvarProrrogacao}>Registar +{diasProrrogacao} dias</Button>
                </div>
              </div>
            )}

            {isSubstituindo && (
              <div className="space-y-3 bg-orange-50 p-4 rounded-xl border border-orange-200">
                <h4 className="font-bold text-orange-900 flex items-center gap-2"><User className="w-4 h-4" /> Substituição de Encarregado</h4>
                <Input value={novoEncarregado} onChange={(e) => setNovoEncarregado(e.target.value)} placeholder="Novo encarregado" />
                <Input value={novaPortaria} onChange={(e) => setNovaPortaria(e.target.value)} placeholder="Nova portaria" />
                <Textarea value={motivoSubstituicao} onChange={(e) => setMotivoSubstituicao(e.target.value)} rows={3} placeholder="Motivo (opcional)" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsSubstituindo(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={salvarSubstituicao}>Registar Substituição</Button>
                </div>
              </div>
            )}

            <div className="bg-sky-50 p-5 rounded-xl border border-sky-200">
              <h4 className="font-bold text-sky-900 flex items-center gap-2 mb-2"><Clock className="w-5 h-5" /> Processo em curso</h4>
              <p className="text-sm text-sky-800 mb-3">Controle de prazos e instrução da solução do PA.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" className="border-amber-300 text-amber-800" onClick={() => setIsProrrogando(true)}>
                  <PlusCircle className="w-4 h-4 mr-1" /> Prorrogar (+{diasProrrogacao}d)
                </Button>
                <Button variant="outline" className="border-orange-300 text-orange-800" onClick={() => setIsSubstituindo(true)}>
                  <User className="w-4 h-4 mr-1" /> Substituir Encarregado
                </Button>
              </div>
            </div>

            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_ENVIAR_SOLUCAO", "AGUARDANDO_CHEFIA_SOLUCAO"), "Solução do PA elaborada e encaminhada à chefia para despacho.")} className="w-full bg-slate-900 hover:bg-black">
              <PenTool className="w-4 h-4 mr-1" /> {labelAcaoConfigurada("PA_ENVIAR_SOLUCAO", "Elaborar Solução e Enviar à Chefia")}
            </Button>
            {renderAcoesCustomizadas(["PA_ENVIAR_SOLUCAO"])}
          </div>
        );

      case "APTO_FINALIZAR":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-800 mb-3">Transcrever Despachos</h4>
              <Textarea value={despachoFinal} onChange={(e) => setDespachoFinal(e.target.value)} rows={4} />
            </div>
            <Button disabled={!despachoFinal.trim()} onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_FINALIZAR_PADRAO", "CONCLUIDO"), "Despacho final registrado e PA encerrado.", { despachoFinal: despachoFinal.trim() })} className="w-full bg-slate-900 hover:bg-black">
              {labelAcaoConfigurada("PA_FINALIZAR_PADRAO", "Registar Despachos e Finalizar")}
            </Button>
            {renderAcoesCustomizadas(["PA_FINALIZAR_PADRAO"])}
          </div>
        );

      default:
        return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação da Chefia.</div>;
    }
  };

  const renderVisaoChefePadrao = () => {
    switch (situacaoFluxo) {
      case "AGUARDANDO_CHEFIA":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {cabecalhoReadOnly}
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
              <h4 className="font-bold text-indigo-900 text-sm mb-2 flex items-center gap-2"><PenTool className="w-4 h-4" /> Confirmação de Assinatura</h4>
              <Label htmlFor="assinatura-chefia-pa">Data da assinatura</Label>
              <Input id="assinatura-chefia-pa" type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} className="mt-1" />
            </div>
            <Button disabled={!dataAssinatura} onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_CHEFIA_CONFIRMA_ASSINATURA", "AGUARDANDO_PRAZO"), "Assinatura da portaria confirmada pela chefia.", { dataAssinatura, portariaAssinadaEm: new Date().toISOString() })} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {labelAcaoConfigurada("PA_CHEFIA_CONFIRMA_ASSINATURA", "Confirmar Assinatura e Devolver")}
            </Button>
            {renderAcoesCustomizadas(["PA_CHEFIA_CONFIRMA_ASSINATURA"])}
          </div>
        );

      case "AGUARDANDO_CHEFIA_SOLUCAO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-200">
              <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2"><FileText className="w-5 h-5" /> Despacho Final do Comandante</h4>
              <p className="text-sm text-indigo-800">Despacho da chefia confirmado e liberado para transcrição final pelo assessor.</p>
            </div>
            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_CHEFIA_CONFIRMA_DESPACHO", "APTO_FINALIZAR"), "Despacho final confirmado pela chefia e devolvido ao assessor.")} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {labelAcaoConfigurada("PA_CHEFIA_CONFIRMA_DESPACHO", "Confirmar Despacho e Devolver")}
            </Button>
            {renderAcoesCustomizadas(["PA_CHEFIA_CONFIRMA_DESPACHO"])}
          </div>
        );

      default:
        return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação do Assessor.</div>;
    }
  };

  const recalcularPrazo = async () => {
    if (!processoId || !processo) return;
    try {
      const prorrogacoes = Array.isArray(processo.prorrogacoes) ? processo.prorrogacoes : [];
      if (prorrogacoes.length === 0) {
        toast.info("Nenhuma prorrogação registrada.");
        return;
      }

      const dataInicio = processo.dataInicioPrazo || "";
      const dataAssin = processo.dataAssinatura || "";

      const prazoCalculado = calcularPrazoFinalPA({
        tipoPA: processo.tipoPA,
        dataInicioPrazo: dataInicio,
        dataAssinatura: dataAssin,
        prorrogacoes,
      }, siteSettings);

      if (!prazoCalculado) {
        toast.error("Não foi possível calcular o prazo.");
        return;
      }

      const prazoAtual = processo.prazoFatal || processo.finalPrazo;
      if (prazoAtual === prazoCalculado) {
        toast.info(`Prazo já está correto: ${formatarData(prazoCalculado)}`);
        return;
      }

      await atualizarComSnapshotPA({
        prazoFatal: prazoCalculado,
        finalPrazo: prazoCalculado,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });

      setProcesso({
        ...processo,
        prazoFatal: prazoCalculado,
        finalPrazo: prazoCalculado,
      });

      toast.success(`✅ Prazo recalculado e atualizado para ${formatarData(prazoCalculado)}`);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao recalcular prazo:", error);
      toast.error("Erro ao recalcular prazo.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(opening) => {
      if (!opening) {
        resetFormularios();
        setProcesso(null);
      }
      onOpenChange(opening);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações PA - {numeroProcesso}</DialogTitle>
          <DialogDescription>
            Fluxo orientado por máquina de estados para Sindicância, IPM e Conselhos.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="py-8 text-center text-sm text-slate-500">Carregando fluxo do PA...</div>
        ) : !processo ? (
          <div className="py-8 text-center text-sm text-slate-500">Não foi possível carregar este processo.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 flex items-center justify-between text-xs">
              <span className="text-slate-600">Perfil atual</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  {role === "assessor_pa" ? <User className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  {role === "assessor_pa" ? "Assessor PA" : "Chefe AssJur"}
                </span>
                {isAdmin(user) && historicoProrrogacoes.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={recalcularPrazo}
                    className="text-[10px] h-6 border-amber-300 text-amber-700 hover:bg-amber-50"
                    title="Recalcula prazo baseado em prorrogações"
                  >
                    Recalcular Prazo
                  </Button>
                )}
              </div>
            </div>

            {isConselho
              ? (role === "assessor_pa" ? renderVisaoAssessorConselho() : renderVisaoChefeConselho())
              : (role === "assessor_pa" ? renderVisaoAssessorPadrao() : renderVisaoChefePadrao())}

            {situacaoFluxo === "CONCLUIDO" && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Fluxo concluído.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
