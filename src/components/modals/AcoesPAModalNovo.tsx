import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { calcularFaixasProrrogacaoPA, calcularPrazoFinalPA, formatarData, obterRegraPrazoPA } from "@/lib/prazo";
import { addDays, format } from "date-fns";
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
  prazoFatal?: string;
  finalPrazo?: string;
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
  
  // Novos campos: Editar Data de Início
  const [isEditandoDataInicio, setIsEditandoDataInicio] = useState(false);
  const [novaDataInicio, setNovaDataInicio] = useState("");

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
    setIsEditandoDataInicio(false);
    setNovaDataInicio("");
  };

  const obterValorData = (estadoLocal: string, processoField?: string): string => {
    const local = estadoLocal?.trim();
    const procValue = processoField?.trim?.();
    if (local) return local;
    if (procValue) return procValue;
    return "";
  };

  const tipoProcesso = processo?.tipoPA || "";
  const isConselho = tipoProcesso === "Conselho de Disciplina" || tipoProcesso === "Conselho de Justificação";
  const isSindicancia = tipoProcesso === "Sindicância" || tipoProcesso === "Sindicancia";
  const { diasIniciais, diasProrrogacao } = obterRegraPrazoPA(tipoProcesso);
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

      if (novaSituacao === "AGUARDANDO_CHEFIA") patch.aguardandoAssinaturaCmt = true;
      if (novaSituacao === "AGUARDANDO_PRAZO") patch.aguardandoAssinaturaCmt = false;

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
      
      const dataInicioParaCalculo = obterValorData(dataInicioPrazo, processo?.dataInicioPrazo);
      const dataAssinaturaParaCalculo = obterValorData(dataAssinatura, processo?.dataAssinatura);
      
      const faixasProrrogacao = calcularFaixasProrrogacaoPA({
        tipoPA: tipoProcesso,
        dataInicioPrazo: dataInicioParaCalculo,
        dataAssinatura: dataAssinaturaParaCalculo,
        prorrogacoes: novasProrrogacoes,
      }, siteSettings);

      const novasProrrogacoesComFaixa = novasProrrogacoes.map((p, index) => ({
        ...p,
        inicio: faixasProrrogacao[index]?.inicio || p.inicio,
        fim: faixasProrrogacao[index]?.fim || p.fim,
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

  const salvarNovaDataInicio = async () => {
    if (!novaDataInicio) {
      toast.error("Informe a nova data de início.");
      return;
    }
    try {
      const dataAssinaturaParaCalculo = obterValorData(dataAssinatura, processo?.dataAssinatura);
      
      const prazoCalculado = calcularPrazoFinalPA({
        tipoPA: tipoProcesso,
        dataInicioPrazo: novaDataInicio,
        dataAssinatura: dataAssinaturaParaCalculo,
        prorrogacoes: historicoProrrogacoes,
      }, siteSettings);
      
      const camposPrazoCalculados = prazoCalculado ? { prazoFatal: prazoCalculado, finalPrazo: prazoCalculado } : {};
      
      await atualizarComSnapshotPA({
        dataInicioPrazo: novaDataInicio,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        descricao: `Data de início do prazo corrigida para ${formatarData(novaDataInicio)}.`,
        ...camposPrazoCalculados,
      });
      
      await registrarHistorico(`Data de início do prazo corrigida para ${formatarData(novaDataInicio)}.`);
      
      setDataInicioPrazo(novaDataInicio);
      if (processo) {
        setProcesso({ ...processo, dataInicioPrazo: novaDataInicio, ...camposPrazoCalculados });
      }
      setIsEditandoDataInicio(false);
      setNovaDataInicio("");
      if (onSuccess) onSuccess();
      toast.success("Data de início atualizada com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar data de início:", error);
      toast.error("Não foi possível atualizar a data de início.");
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
    
    void avancarFluxo(proximaSituacaoConfigurada("PA_INICIAR_PRAZO", "EM_CURSO"), `Prazo iniciado em ${formatarData(dataInicioParaCalculo)}.`, {
      dataInicioPrazo: dataInicioParaCalculo,
      ...camposPrazoCalculados,
    });
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
      </div>
    </div>
  );

  const renderVisaoAssessorConselho = () => {
    switch (situacaoFluxo) {
      case "C_MEMORIA":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {cabecalhoReadOnly}
            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_ENVIAR_MEMORIA", "C_PORTARIA"), "Memória enviada à chefia.")} className="w-full bg-rose-600 hover:bg-rose-700">
              {labelAcaoConfigurada("C_ENVIAR_MEMORIA", "Elaborar Memória e Enviar à Chefia")}
            </Button>
            {renderAcoesCustomizadas(["C_ENVIAR_MEMORIA"])}
          </div>
        );

      case "C_EM_CURSO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {historicoProrrogacoes.length > 0 && (
              <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                <h4 className="text-sm font-bold text-rose-900 mb-1 flex items-center gap-2"><History className="w-4 h-4" /> Prorrogações ({historicoProrrogacoes.length})</h4>
                {historicoProrrogacoes.map((p, i) => (
                  <div key={i} className="text-[11px] bg-white p-1 rounded border mb-1 flex justify-between">
                    <span>{p.doc}</span><span className="font-bold">+{p.dias}d</span>
                  </div>
                ))}
              </div>
            )}

            {isProrrogando && (
              <div className="space-y-3 bg-rose-50 p-4 rounded-xl border border-rose-200">
                <h4 className="font-bold text-rose-900 flex items-center gap-2"><Timer className="w-4 h-4" /> Registrar Prorrogação</h4>
                <Input value={docProrrogacao} onChange={(e) => setDocProrrogacao(e.target.value)} placeholder="Documento concessório" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsProrrogando(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-rose-600" onClick={salvarProrrogacao}>Registar +{diasProrrogacao}d</Button>
                </div>
              </div>
            )}

            {isEditandoDataInicio && (
              <div className="space-y-3 bg-sky-50 p-4 rounded-xl border border-sky-200">
                <h4 className="font-bold text-sky-900 flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Editar Data de Início</h4>
                <Input type="date" value={novaDataInicio} onChange={(e) => setNovaDataInicio(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditandoDataInicio(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-sky-600" onClick={salvarNovaDataInicio}>Salvar Nova Data</Button>
                </div>
              </div>
            )}

            {!isProrrogando && !isEditandoDataInicio && (
              <div className="bg-sky-50 p-5 rounded-xl border border-sky-200">
                <h4 className="font-bold text-sky-900 flex items-center gap-2 mb-2"><Users className="w-5 h-5" /> Conselho em Curso</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" className="flex-1 border-rose-300 text-rose-700" onClick={() => setIsProrrogando(true)}>
                    <PlusCircle className="w-4 h-4 mr-1" /> Prorrogar (+{diasProrrogacao}d)
                  </Button>
                  <Button variant="outline" className="flex-1 border-sky-300 text-sky-700" onClick={() => { setIsEditandoDataInicio(true); setNovaDataInicio(dataInicioPrazo); }}>
                    <CalendarIcon className="w-4 h-4 mr-1" /> Editar Início
                  </Button>
                </div>
              </div>
            )}

            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("C_ENVIAR_DECISAO_AUT", "C_DECISAO_AUT_NOMEANTE"), "Enviado para decisão.")} className="w-full bg-slate-800 hover:bg-black">
              <PenTool className="w-4 h-4 mr-1" /> Enviar p/ Decisão da Autoridade
            </Button>
          </div>
        );

      default:
        return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação da Chefia.</div>;
    }
  };

  const renderVisaoAssessorPadrao = () => {
    switch (situacaoFluxo) {
      case "MESA_ASSESSOR_NOVO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            {cabecalhoReadOnly}
            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_ENVIAR_CHEFIA", "AGUARDANDO_CHEFIA"), "Enviado à chefia.")} className="w-full bg-sky-600 hover:bg-sky-700">
              {labelAcaoConfigurada("PA_ENVIAR_CHEFIA", "Enviar para a Chefia da AssJur")}
            </Button>
          </div>
        );

      case "AGUARDANDO_PRAZO":
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
              <h4 className="font-bold text-emerald-900 mb-3 flex items-center gap-2"><FileBadge className="w-5 h-5" /> Portaria assinada</h4>
              <Label htmlFor="inicio-prazo-pa">Data de início do prazo</Label>
              <Input id="inicio-prazo-pa" type="date" value={dataInicioPrazo} onChange={(e) => setDataInicioPrazo(e.target.value)} className="mt-1" />
            </div>
            <Button disabled={!dataInicioPrazo} onClick={iniciarPrazoPadrao} className="w-full bg-emerald-600">Iniciar Prazo</Button>
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
                  {historicoProrrogacoes.map((p, i) => (
                    <div key={i} className="text-[11px] bg-white text-amber-800 p-1 border-b flex justify-between last:border-0">
                      <span>{p.doc}</span><span className="font-bold">+{p.dias}d</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isProrrogando && (
              <div className="space-y-3 bg-amber-50 p-4 rounded-xl border border-amber-200">
                <h4 className="font-bold text-amber-900 flex items-center gap-2"><Timer className="w-4 h-4" /> Registrar Prorrogação</h4>
                <Input value={docProrrogacao} onChange={(e) => setDocProrrogacao(e.target.value)} placeholder="Documento concessório" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsProrrogando(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-amber-600" onClick={salvarProrrogacao}>Registar +{diasProrrogacao}d</Button>
                </div>
              </div>
            )}

            {isSubstituindo && (
              <div className="space-y-3 bg-orange-50 p-4 rounded-xl border border-orange-200">
                <h4 className="font-bold text-orange-900 flex items-center gap-2"><User className="w-4 h-4" /> Substituição de Encarregado</h4>
                <Input value={novoEncarregado} onChange={(e) => setNovoEncarregado(e.target.value)} placeholder="Novo encarregado" />
                <Input value={novaPortaria} onChange={(e) => setNovaPortaria(e.target.value)} placeholder="Nova portaria" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsSubstituindo(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-orange-600" onClick={salvarSubstituicao}>Salvar</Button>
                </div>
              </div>
            )}

            {isEditandoDataInicio && (
              <div className="space-y-3 bg-sky-50 p-4 rounded-xl border border-sky-200">
                <h4 className="font-bold text-sky-900 flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Editar Data de Início</h4>
                <Input type="date" value={novaDataInicio} onChange={(e) => setNovaDataInicio(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setIsEditandoDataInicio(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-sky-600" onClick={salvarNovaDataInicio}>Salvar Nova Data</Button>
                </div>
              </div>
            )}

            {!isProrrogando && !isSubstituindo && !isEditandoDataInicio && (
              <div className="bg-sky-50 p-5 rounded-xl border border-sky-200">
                <h4 className="font-bold text-sky-900 flex items-center gap-2 mb-2"><Clock className="w-5 h-5" /> Processo em curso</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button variant="outline" className="border-amber-300 text-amber-800 text-xs px-2" onClick={() => setIsProrrogando(true)}>
                    <PlusCircle className="w-3.5 h-3.5 mr-1" /> Prorrogar (+{diasProrrogacao}d)
                  </Button>
                  <Button variant="outline" className="border-orange-300 text-orange-800 text-xs px-2" onClick={() => setIsSubstituindo(true)}>
                    <User className="w-3.5 h-3.5 mr-1" /> Substituir Enc.
                  </Button>
                  <Button variant="outline" className="border-sky-300 text-sky-800 text-xs px-2" onClick={() => { setIsEditandoDataInicio(true); setNovaDataInicio(dataInicioPrazo); }}>
                    <CalendarIcon className="w-3.5 h-3.5 mr-1" /> Editar Início
                  </Button>
                </div>
              </div>
            )}

            {isSindicancia && (
              <Button onClick={entregarSindicancia} className="w-full bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-4 h-4 mr-1" /> Sindicância Entregue
              </Button>
            )}

            <Button onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_ENVIAR_SOLUCAO", "AGUARDANDO_CHEFIA_SOLUCAO"), "Solução enviada.")} className="w-full bg-slate-900 hover:bg-black">
              <PenTool className="w-4 h-4 mr-1" /> Elaborar Solução e Enviar à Chefia
            </Button>
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
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
              <h4 className="font-bold text-indigo-900 text-sm mb-2"><PenTool className="w-4 h-4 inline mr-2" /> Data da assinatura</h4>
              <Input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
            </div>
            <Button disabled={!dataAssinatura} onClick={() => avancarFluxo(proximaSituacaoConfigurada("PA_CHEFIA_CONFIRMA_ASSINATURA", "AGUARDANDO_PRAZO"), "Assinatura confirmada.")} className="w-full bg-indigo-600">Confirmar e Devolver</Button>
          </div>
        );

      // Tarefa 2 — Chefia também precisa enxergar o botão "Sindicância Entregue"
      // quando uma Sindicância está em curso (admin pode operar pelo encarregado).
      case "EM_CURSO":
        if (!isSindicancia) {
          return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação do Assessor.</div>;
        }
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-sm text-emerald-900">
              <h4 className="font-bold flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" /> Sindicância em curso
              </h4>
              Ao registrar a entrega, será aberto um novo prazo de <strong>10 dias</strong> para confecção da solução.
            </div>
            <Button onClick={entregarSindicancia} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-1" /> Sindicância Entregue
            </Button>
          </div>
        );

      default:
        return <div className="text-center text-sm text-slate-500 py-4">Aguardando ação do Assessor.</div>;
    }
  };

  /**
   * Tarefa 1 — Sindicância entregue pelo encarregado.
   * Quando uma Sindicância em curso é entregue, abrimos um novo prazo de 10 dias
   * (a partir de hoje) para a confecção da solução pela AssJur.
   * - Mantém a situação em EM_CURSO (assessor segue trabalhando na solução).
   * - Reseta dataInicioPrazo para hoje e prazoFatal/finalPrazo para hoje + 10 dias.
   * - Usa atualizarComSnapshotPA para preservar o snapshot de auditoria (Tarefa 3).
   */
  const entregarSindicancia = async () => {
    if (!processoId || !user) return;
    if (!isSindicancia) {
      toast.error("Ação disponível apenas para Sindicâncias.");
      return;
    }
    try {
      const hoje = new Date();
      const hojeISO = format(hoje, "yyyy-MM-dd");
      const novoPrazoISO = format(addDays(hoje, 10), "yyyy-MM-dd");
      const descricao = "Sindicância entregue pelo encarregado. Iniciado prazo de 10 dias para confecção da solução.";

      await atualizarComSnapshotPA({
        situacaoFluxo: "EM_CURSO",
        status: "andamento",
        finalizado: false,
        dataInicioPrazo: hojeISO,
        prazoFatal: novoPrazoISO,
        finalPrazo: novoPrazoISO,
        descricao,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });
      await registrarHistorico(
        `${descricao} Novo prazo fatal: ${formatarData(novoPrazoISO)}.`,
      );

      setDataInicioPrazo(hojeISO);
      setSituacaoFluxo("EM_CURSO");
      if (processo) {
        setProcesso({
          ...processo,
          situacaoFluxo: "EM_CURSO",
          dataInicioPrazo: hojeISO,
          prazoFatal: novoPrazoISO,
          finalPrazo: novoPrazoISO,
        });
      }
      if (onSuccess) onSuccess();
      toast.success(`Sindicância entregue. Novo prazo: ${formatarData(novoPrazoISO)}.`);
    } catch (error) {
      console.error("Erro ao registrar entrega da sindicância:", error);
      toast.error("Falha ao registrar a entrega da sindicância.");
    }
  };

  const recalcularPrazo = async () => {
    if (!processoId || !processo) return;
    try {
      const prorrogacoes = Array.isArray(processo.prorrogacoes) ? processo.prorrogacoes : [];
      const prazoCalculado = calcularPrazoFinalPA({
        tipoPA: processo.tipoPA,
        dataInicioPrazo: dataInicioPrazo || processo.dataInicioPrazo || "",
        dataAssinatura: dataAssinatura || processo.dataAssinatura || "",
        prorrogacoes,
      }, siteSettings);

      if (prazoCalculado) {
        await atualizarComSnapshotPA({ prazoFatal: prazoCalculado, finalPrazo: prazoCalculado, atualizadoEm: Timestamp.now() });
        toast.success(`Prazo recalculado: ${formatarData(prazoCalculado)}`);
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      toast.error("Erro ao recalcular.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(opening) => { if (!opening) resetFormularios(); onOpenChange(opening); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Ações PA - {numeroProcesso}</DialogTitle></DialogHeader>
        {carregando ? (
          <div className="py-8 text-center text-sm">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-slate-50 px-3 py-2 flex items-center justify-between text-xs font-bold">
              <span>{role === "assessor_pa" ? "Assessor PA" : "Chefe AssJur"}</span>
              {isAdmin(user) && <Button variant="outline" size="sm" onClick={recalcularPrazo} className="h-6 text-[10px]">Recalcular Prazo</Button>}
            </div>
            {isConselho 
              ? (role === "assessor_pa" ? renderVisaoAssessorConselho() : null) 
              : (role === "assessor_pa" ? renderVisaoAssessorPadrao() : renderVisaoChefePadrao())}
            {situacaoFluxo === "CONCLUIDO" && <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-sm font-semibold">✓ Fluxo concluído.</div>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}