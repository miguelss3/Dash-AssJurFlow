import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Processo } from "@/types/processo";
import { collection, addDoc, updateDoc, doc, Timestamp, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calcularFaixasProrrogacaoPA, calcularPrazoFinalPA } from "@/lib/prazo";
import {
  DEFAULT_ORIGENS_DU_DOCUMENTOS,
  DEFAULT_SECOES_DU,
  DEFAULT_ASSUNTOS_PA_SINDICANCIA,
  DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
  normalizarOrigensDUDocumentos,
  normalizarSecoesDU,
  normalizarAssuntosPA,
  normalizarAssuntosDU,
  type SiteSettings,
} from "@/types/siteSettings";

interface CadastroProcessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo?: Processo | null;
  onSuccess?: () => void;
  siteSettings?: SiteSettings;
}

const TIPOS_PA = ["IPM", "Sindicância", "Conselho de Disciplina", "Conselho de Justificação", "Investigação Preliminar", "Outros"];
const POSTOS_CONSELHO = ["Cap", "Maj", "TC", "Cel"];
const POSTOS_ENCARREGADO = ["Sgt", "Ten", "Cap", "Maj", "TC", "Cel"];

type ProrrogacaoEditavel = {
  dias: number;
  doc: string;
  inicio: string;
  fim: string;
  em?: string;
  por?: string;
};

// LOG DE VERIFICAÇÃO - ESTE LOG DEVE APARECER SEMPRE
// console.log("🚀🚀🚀 ARQUIVO CadastroProcessoModal.tsx CARREGADO - VERSÃO NOVA COM LOGS! 🚀🚀🚀");

export function CadastroProcessoModal({ open, onOpenChange, processo, onSuccess, siteSettings }: CadastroProcessoModalProps) {
  const { user } = useAuth();
  const ehAdminOuChefe = isAdmin(user);
  const assuntosDUPrincipais = useMemo(
    () =>
      normalizarAssuntosDU(
        siteSettings?.assuntosDUPrincipais,
        DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
      ),
    [siteSettings?.assuntosDUPrincipais],
  );
  const assuntosPASindicancia = useMemo(
    () =>
      normalizarAssuntosPA(
        siteSettings?.assuntosPASindicancia,
        DEFAULT_ASSUNTOS_PA_SINDICANCIA,
      ),
    [siteSettings?.assuntosPASindicancia],
  );
  const origensDUDocumentos = useMemo(
    () =>
      normalizarOrigensDUDocumentos(
        siteSettings?.origensDUDocumentos,
        DEFAULT_ORIGENS_DU_DOCUMENTOS,
      ),
    [siteSettings?.origensDUDocumentos],
  );
  const secoesDU = useMemo(
    () => normalizarSecoesDU(siteSettings?.secoesDU, DEFAULT_SECOES_DU),
    [siteSettings?.secoesDU],
  );

  const inferirSetorUsuario = () => {
    const candidatos = [user?.setor, user?.role, user?.secao, user?.cargo]
      .filter(Boolean)
      .map((v) => v!.toString().toUpperCase());

    if (candidatos.some((v) => v.includes("DU") || v.includes("DEFESA DE USU"))) {
      return "DU";
    }
    if (candidatos.some((v) => v.includes("PA") || v.includes("PROCESSOS ADMIN"))) {
      return "PA";
    }
    return "";
  };

  const inferirSetorPorCampos = (...valores: Array<unknown>): "DU" | "PA" | "" => {
    const candidatos = valores
      .filter(Boolean)
      .map((valor) => valor!.toString().toUpperCase());

    if (candidatos.some((valor) => valor.includes("DU") || valor.includes("DEFESA DE USU"))) {
      return "DU";
    }
    if (candidatos.some((valor) => valor.includes("PA") || valor.includes("PROCESSOS ADMIN"))) {
      return "PA";
    }
    return "";
  };

  const setorUsuarioNormalizado = inferirSetorUsuario();
  const podeCadastrarDU = ehAdminOuChefe || setorUsuarioNormalizado === "DU";
  const podeCadastrarPA = ehAdminOuChefe || setorUsuarioNormalizado === "PA";
  const setorPadraoPermitido: "DU" | "PA" | "" = podeCadastrarDU ? "DU" : (podeCadastrarPA ? "PA" : "");
  
  // console.log("🔐 CadastroProcessoModal - User logado:", user?.email || "Nenhum usuário");
  // console.log("🔐 Modal open?", open);
  // console.log("🔐 Processo para editar?", processo?.id || "Não, é cadastro novo");

  // Estado do formulário
  const [setor, setSetor] = useState<"DU" | "PA" | "">("");
  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [parte, setParte] = useState("");
  const [assunto, setAssunto] = useState("");
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  // Campos DU
  const [origemDU, setOrigemDU] = useState("");
  const [secaoDU, setSecaoDU] = useState("SVP");
  const [isMS, setIsMS] = useState(false);
  const [prazoInternoDU, setPrazoInternoDU] = useState("");
  const [prazoFatalDU, setPrazoFatalDU] = useState("");
  const [duDataPrazoFluxo, setDuDataPrazoFluxo] = useState("");
  const [duNumeroSaida, setDuNumeroSaida] = useState("");
  const [duNumeroRecebido, setDuNumeroRecebido] = useState("");
  const [duNumeroDocFinal, setDuNumeroDocFinal] = useState("");

  // Campos PA
  const [tipoPA, setTipoPA] = useState("");
  const [fluxoIPM, setFluxoIPM] = useState<"Novo" | "Diligência" | "Sindicância Antigo">("Novo");
  const [anoLegado, setAnoLegado] = useState("");
  const [postoEncarregado, setPostoEncarregado] = useState("");
  const [nomeEncarregado, setNomeEncarregado] = useState("");
  const [mudouEncarregado, setMudouEncarregado] = useState(false);
  const [postoEncarregadoAtual, setPostoEncarregadoAtual] = useState("");
  const [nomeEncarregadoAtual, setNomeEncarregadoAtual] = useState("");
  const [novaPortaria, setNovaPortaria] = useState("");
  const [assuntoSindicancia, setAssuntoSindicancia] = useState("");
  const [especificidadesSindicancia, setEspecificidadesSindicancia] = useState("");
  const [omPresidenteConselho, setOmPresidenteConselho] = useState("");
  const [prorrogacoesEditaveis, setProrrogacoesEditaveis] = useState<ProrrogacaoEditavel[]>([]);
  const [dataInicioPrazoPA, setDataInicioPrazoPA] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(resetForm, 300);
    } else if (processo) {
      preencherParaEdicao(processo);
    } else {
      resetForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, processo]);

  useEffect(() => {
    // Se o usuário carregar depois da abertura do modal, garante pré-seleção do setor permitido.
    if (!open || processo) return;
    if (setor) return;
    if (!setorPadraoPermitido) return;
    setSetor(setorPadraoPermitido);
  }, [open, processo, setor, setorPadraoPermitido]);

  const resetForm = () => {
    setSetor(setorPadraoPermitido);
    setNumeroProcesso("");
    setParte("");
    setAssunto("");
    setDataEntrada(new Date().toISOString().split("T")[0]);
    setObservacoes("");
    setOrigemDU("");
    setSecaoDU("SVP");
    setIsMS(false);
    setPrazoInternoDU("");
    setPrazoFatalDU("");
    setDuDataPrazoFluxo("");
    setDuNumeroSaida("");
    setDuNumeroRecebido("");
    setDuNumeroDocFinal("");
    setTipoPA("");
    setFluxoIPM("Novo");
    setAnoLegado("");
    setPostoEncarregado("");
    setNomeEncarregado("");
    setMudouEncarregado(false);
    setPostoEncarregadoAtual("");
    setNomeEncarregadoAtual("");
    setNovaPortaria("");
    setAssuntoSindicancia("");
    setEspecificidadesSindicancia("");
    setOmPresidenteConselho("");
    setProrrogacoesEditaveis([]);
    setDataInicioPrazoPA("");
  };

  const preencherParaEdicao = (p: Processo) => {
    setSetor((p.setor as "DU" | "PA") || "DU");
    setNumeroProcesso(p.numero || "");
    setParte(p.cliente || "");
    setAssunto(p.tipoAcao || "");
    setDataEntrada(p.dataEntrada || new Date().toISOString().split("T")[0]);
    setObservacoes(p.observacoes || "");
    
    if (p.setor === "DU") {
      setOrigemDU(p.origemDU || "");
      setSecaoDU(p.secaoDU || "SVP");
      setIsMS(p.isMS || false);
      setPrazoInternoDU(p.prazo || "");
      setPrazoFatalDU(p.prazoFatal || "");

      const pedido = p.pedidoSubsidios || {};
      const resposta = p.respostaDU || {};
      setDuDataPrazoFluxo(pedido.dataPrazo || pedido.prazoResposta || "");
      setDuNumeroSaida(pedido.numeroSaida || pedido.numeroDiex || resposta.numeroDiex || "");
      setDuNumeroRecebido(pedido.numeroRecebido || resposta.numeroRecebido || "");
      setDuNumeroDocFinal(pedido.numeroDocFinal || resposta.numeroOficio || "");
    }

    if (p.setor === "PA") {
      setTipoPA(p.tipoPA || "");
      const conselhoPA = p.tipoPA === "Conselho de Disciplina" || p.tipoPA === "Conselho de Justificação";
      
      // Determinar fluxo
      const temDiligencia = p.faseAtual?.includes?.("diligencia") || p.faseAtual?.includes?.("Diligência");
      const ehLegado = p.faseAtual?.includes?.("Antiga") || p.faseAtual?.includes?.("antiga");
      
      if (ehLegado) {
        setFluxoIPM("Sindicância Antigo");
      } else if (temDiligencia) {
        setFluxoIPM("Diligência");
      } else {
        setFluxoIPM("Novo");
      }

      // Encarregado
      if (p.encarregado) {
        const partes = p.encarregado.split(" ");
        if (partes.length > 1) {
          setPostoEncarregado(partes[0]);
          setNomeEncarregado(partes.slice(1).join(" "));
        } else {
          setNomeEncarregado(p.encarregado);
        }
      }

      if (conselhoPA) {
        if (p.presidenteConselhoPosto) {
          setPostoEncarregado(p.presidenteConselhoPosto);
        }
        if (p.presidenteConselhoNome) {
          setNomeEncarregado(p.presidenteConselhoNome);
        }
        setOmPresidenteConselho(p.omPresidenteConselho || "");
      }

      // Assunto sindicância
      if (p.tipoPA === "Sindicância" && p.tipoAcao) {
        const partes = p.tipoAcao.split(" - ");
        if (partes.length > 1) {
          setAssuntoSindicancia(partes[0]);
          setEspecificidadesSindicancia(partes.slice(1).join(" - "));
        } else {
          setAssunto(p.tipoAcao);
        }
      }

      const faixasProrrogacao = calcularFaixasProrrogacaoPA({
        tipoPA: p.tipoPA,
        dataInicioPrazo: p.dataInicioPrazo,
        dataAssinatura: p.dataAssinatura,
        prorrogacoes: p.prorrogacoes,
      });

      const listaEditavel = faixasProrrogacao.map((faixa, index) => ({
        dias: faixa.dias,
        doc: p.prorrogacoes?.[index]?.doc || "",
        inicio: faixa.inicio,
        fim: faixa.fim,
        em: p.prorrogacoes?.[index]?.em,
        por: p.prorrogacoes?.[index]?.por,
      }));

      setProrrogacoesEditaveis(listaEditavel);
      setDataInicioPrazoPA(p.dataInicioPrazo || "");
    }
  };

  const toDataCivil = (valor: string): string => {
    const texto = (valor || "").trim();
    const prefixo = texto.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    return prefixo || "";
  };

  const somarDias = (dataISO: string, dias: number): string => {
    const base = toDataCivil(dataISO);
    if (!base) return "";
    const data = new Date(`${base}T00:00:00`);
    if (Number.isNaN(data.getTime())) return "";
    data.setDate(data.getDate() + dias);
    return data.toISOString().slice(0, 10);
  };

  const diferencaDias = (inicioISO: string, fimISO: string): number => {
    const inicio = toDataCivil(inicioISO);
    const fim = toDataCivil(fimISO);
    if (!inicio || !fim) return 0;
    const dataInicio = new Date(`${inicio}T00:00:00`);
    const dataFim = new Date(`${fim}T00:00:00`);
    if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) return 0;
    const msDia = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.round((dataFim.getTime() - dataInicio.getTime()) / msDia));
  };

  const atualizarProrrogacao = (
    index: number,
    campo: "doc" | "dias" | "inicio" | "fim",
    valor: string,
  ) => {
    setProrrogacoesEditaveis((atual) => {
      const copia = [...atual];
      const item = { ...copia[index] };

      if (campo === "doc") {
        item.doc = valor;
      }

      if (campo === "dias") {
        const dias = Math.max(0, Math.trunc(Number(valor) || 0));
        item.dias = dias;
        if (toDataCivil(item.inicio)) {
          item.fim = somarDias(item.inicio, dias);
        }
      }

      if (campo === "inicio") {
        item.inicio = toDataCivil(valor);
        if (item.inicio) {
          item.fim = somarDias(item.inicio, item.dias || 0);
        }
      }

      if (campo === "fim") {
        item.fim = toDataCivil(valor);
        if (toDataCivil(item.inicio) && toDataCivil(item.fim)) {
          item.dias = diferencaDias(item.inicio, item.fim);
        }
      }

      copia[index] = item;
      return copia;
    });
  };

  const adicionarProrrogacaoEditavel = () => {
    setProrrogacoesEditaveis((atual) => {
      const ultimaFim = atual.length > 0 ? toDataCivil(atual[atual.length - 1].fim) : "";
      return [
        ...atual,
        {
          dias: 20,
          doc: "",
          inicio: ultimaFim,
          fim: ultimaFim ? somarDias(ultimaFim, 20) : "",
        },
      ];
    });
  };

  const removerProrrogacaoEditavel = (index: number) => {
    setProrrogacoesEditaveis((atual) => atual.filter((_, i) => i !== index));
  };

  const recalcularProrrogacoesComBase = (
    inicioPrazoBase: string,
    itens: ProrrogacaoEditavel[],
  ): ProrrogacaoEditavel[] => {
    const dataBase = toDataCivil(inicioPrazoBase);
    if (!dataBase || itens.length === 0) return itens;

    const faixas = calcularFaixasProrrogacaoPA({
      tipoPA,
      dataInicioPrazo: dataBase,
      dataAssinatura: processo?.dataAssinatura,
      prorrogacoes: itens.map((item) => ({
        dias: Math.max(0, Math.trunc(Number(item.dias) || 0)),
        inicio: toDataCivil(item.inicio) || undefined,
        fim: toDataCivil(item.fim) || undefined,
      })),
    });

    return itens.map((item, index) => ({
      ...item,
      dias: faixas[index]?.dias ?? item.dias,
      inicio: faixas[index]?.inicio ?? item.inicio,
      fim: faixas[index]?.fim ?? item.fim,
    }));
  };

  useEffect(() => {
    if (setor !== "PA" || !processo?.id) return;
    if (!toDataCivil(dataInicioPrazoPA)) return;

    setProrrogacoesEditaveis((atual) => recalcularProrrogacoesComBase(dataInicioPrazoPA, atual));
  }, [dataInicioPrazoPA, setor, processo?.id, tipoPA]);

  const isConselhoPA = (tipo: string) => {
    return tipo === "Conselho de Disciplina" || tipo === "Conselho de Justificação";
  };

  const usaPortariaPA = (tipo: string) => {
    const norm = tipo.toLowerCase();
    return norm.includes("ipm") || norm.includes("sindic") || norm.includes("conselho");
  };

  const aceitaDiligencia = (tipo: string) => {
    const norm = tipo.toLowerCase();
    return norm.includes("ipm") || norm.includes("sindic");
  };

  const formatarPortaria = (valor: string) => {
    const texto = valor.trim();
    if (!texto) return "";
    return /^portaria/i.test(texto) ? texto : `Portaria Nr ${texto}`;
  };

  const anosLegado = Array.from({ length: 4 }, (_, idx) => new Date().getFullYear() - 4 + idx);

  const labelNumeroProcesso = () => {
    if (setor === "DU") {
      if (assunto === "Requerimento EXTRAJUDICIAL") return "NUP / SAPIENS / Nº Documento (opcional)";
      return "NUP / SAPIENS / Nº Documento";
    }
    if (setor === "PA") {
      const isSindicanciaAntiga = tipoPA === "Sindicância" && fluxoIPM === "Sindicância Antigo";
      const isDiligencia = aceitaDiligencia(tipoPA) && fluxoIPM === "Diligência";
      if (isSindicanciaAntiga) return "Número da Portaria Antiga";
      if (isDiligencia) return "1ª Portaria / Ano";
      if (usaPortariaPA(tipoPA)) return "Número da Portaria / Ano";
    }
    return "Número do Processo";
  };

  const placeholderNumeroProcesso = () => {
    if (setor === "DU") {
      if (assunto === "Requerimento EXTRAJUDICIAL") return "Sem nº de processo (opcional)";
      return "Ex: 0001234-56...";
    }
    if (setor === "PA") {
      const isSindicanciaAntiga = tipoPA === "Sindicância" && fluxoIPM === "Sindicância Antigo";
      if (isSindicanciaAntiga) return "Ex: 12";
      if (usaPortariaPA(tipoPA)) return "Ex: Portaria Nr 12/2026";
    }
    return "Ex: 0001234-56...";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // console.log("🎯 handleSubmit INICIADO");
    // console.log("  - Setor:", setor);
    // console.log("  - Número:", numeroProcesso);
    // console.log("  - Parte:", parte);
    // console.log("  - Loading:", loading);
    
    if (loading) {
      // console.log("⚠️ ABORTADO: loading=true");
      return;
    }

    // Validações
    if (!setor) {
      // console.log("❌ VALIDAÇÃO FALHOU: setor vazio");
      toast.error("Selecione o setor.");
      return;
    }

    // Regra de negócio: assessor DU só cadastra DU; assessor PA só cadastra PA.
    if (!ehAdminOuChefe) {
      if (setor === "DU" && !podeCadastrarDU) {
        toast.error("Seu perfil não permite cadastrar processos DU.");
        return;
      }
      if (setor === "PA" && !podeCadastrarPA) {
        toast.error("Seu perfil não permite cadastrar processos PA.");
        return;
      }
    }
    const isRequerimentoExtrajudicial = setor === "DU" && assunto === "Requerimento EXTRAJUDICIAL";
    if (!numeroProcesso.trim() && !isRequerimentoExtrajudicial) {
      // console.log("❌ VALIDAÇÃO FALHOU: numeroProcesso vazio");
      toast.error("Informe o número do processo.");
      return;
    }
    if (!parte.trim()) {
      // console.log("❌ VALIDAÇÃO FALHOU: parte vazia");
      toast.error("Informe a parte.");
      return;
    }
    if (setor === "PA" && !tipoPA) {
      // console.log("❌ VALIDAÇÃO FALHOU: tipoPA vazio");
      toast.error("Selecione o tipo de procedimento do PA.");
      return;
    }
    if (setor === "DU" && !origemDU) {
      // console.log("❌ VALIDAÇÃO FALHOU: origemDU vazia");
      toast.error("Selecione a origem do processo DU.");
      return;
    }
    if (setor === "DU" && !assunto.trim()) {
      // console.log("❌ VALIDAÇÃO FALHOU: assunto DU vazio");
      toast.error("Selecione o assunto principal do processo DU.");
      return;
    }

    // console.log("✅ Todas validações passaram! Prosseguindo...");
    
    const isSindicanciaPA = setor === "PA" && tipoPA === "Sindicância";
    const isConselhoPASelecionado = setor === "PA" && isConselhoPA(tipoPA);
    const isDiligenciaPA = setor === "PA" && aceitaDiligencia(tipoPA) && fluxoIPM === "Diligência";
    const isSindicanciaAntiga = isSindicanciaPA && fluxoIPM === "Sindicância Antigo";

    if (isSindicanciaPA && !assuntoSindicancia) {
      // console.log("❌ VALIDAÇÃO FALHOU: assuntoSindicancia vazio");
      toast.error("Selecione o assunto da Sindicância.");
      return;
    }
    if (isSindicanciaPA && !especificidadesSindicancia.trim()) {
      toast.error("Preencha as especificidades do assunto da Sindicância.");
      return;
    }
    if (isDiligenciaPA && !postoEncarregado) {
      toast.error("Informe o encarregado da 1ª portaria para a diligência.");
      return;
    }
    if (isDiligenciaPA && mudouEncarregado && !postoEncarregadoAtual) {
      toast.error("Informe o encarregado atual quando houver mudança.");
      return;
    }
    if (isDiligenciaPA && mudouEncarregado && !novaPortaria.trim()) {
      toast.error("Informe a nova portaria quando houver mudança de encarregado.");
      return;
    }
    if (isSindicanciaAntiga && !anoLegado) {
      // console.log("❌ VALIDAÇÃO FALHOU: anoLegado vazio");
      toast.error("Selecione o ano da Sindicância Antiga.");
      return;
    }
    if (isConselhoPASelecionado && !postoEncarregado) {
      toast.error("Selecione o posto do Presidente do Conselho.");
      return;
    }
    if (isConselhoPASelecionado && !nomeEncarregado.trim()) {
      toast.error("Informe o nome do Presidente do Conselho.");
      return;
    }
    if (isConselhoPASelecionado && !omPresidenteConselho.trim()) {
      toast.error("Informe a OM do Presidente do Conselho.");
      return;
    }

    if (!processo?.id) {
      if (!user?.uid || !user?.email) {
        toast.error("Sessão inválida. Faça login novamente antes de cadastrar o processo.");
        return;
      }

      const perfilCanonicoRef = doc(db, "usuarios", user.uid);
      const perfilCanonicoSnap = await getDoc(perfilCanonicoRef);

      if (!perfilCanonicoSnap.exists()) {
        toast.error("Seu perfil no Firestore não está sincronizado com o UID de acesso. Abra Gestão de Equipe e salve o cadastro deste usuário novamente.");
        return;
      }

      const perfilCanonico = perfilCanonicoSnap.data();
      const setorPerfilCanonico = inferirSetorPorCampos(
        perfilCanonico.setor,
        perfilCanonico.role,
        perfilCanonico.secao,
        perfilCanonico.cargo,
      );

      if (!ehAdminOuChefe && setorPerfilCanonico && setorPerfilCanonico !== setor) {
        toast.error(`Seu perfil no Firestore está vinculado ao setor ${setorPerfilCanonico}. Cadastro liberado apenas para este setor.`);
        return;
      }
    }

    // console.log("🚀 Iniciando cadastro no Firebase...");
    setLoading(true);

    try {
      const agora = Timestamp.now();
      const agoraISO = new Date().toISOString();
      const nomeBaseAutor = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
      const autorCadastro = user?.posto ? `${user.posto} ${nomeBaseAutor}`.trim() : nomeBaseAutor;
      const autorIdCadastro = user?.uid || "sistema";
      const autorEmailCadastro = user?.email || null;

      // Assunto final
      const assuntoFinal = isSindicanciaPA
        ? `${assuntoSindicancia}${especificidadesSindicancia ? ` - ${especificidadesSindicancia}` : ""}`
        : assunto;

      // Número da portaria
      const valorBasePortaria = isSindicanciaAntiga && anoLegado ? `${numeroProcesso}/${anoLegado}` : numeroProcesso;
      const primeiraPortariaFormatada = (setor === "PA" && (usaPortariaPA(tipoPA) || isSindicanciaAntiga))
        ? formatarPortaria(valorBasePortaria)
        : numeroProcesso;
      const numeroFinal = (mudouEncarregado && novaPortaria) ? formatarPortaria(novaPortaria) : primeiraPortariaFormatada;

      // Encarregado
      const encarregadoPrimeiro = `${postoEncarregado} ${nomeEncarregado}`.trim() || null;
      const encarregadoAtualInformado = `${postoEncarregadoAtual} ${nomeEncarregadoAtual}`.trim() || null;
      const encarregadoPresidente = `${postoEncarregado} ${nomeEncarregado}`.trim() || null;
      const encarregadoFinal = isConselhoPASelecionado
        ? encarregadoPresidente
        : ((isDiligenciaPA && mudouEncarregado) ? encarregadoAtualInformado : encarregadoPrimeiro);

      // Status inicial
      let statusInicial = "Aguardando Distribuição";
      if (setor === "PA") {
        if (isSindicanciaAntiga) statusInicial = "Atrasado";
        else if (isDiligenciaPA) statusInicial = "Diligência";
        else statusInicial = "Distribuído";
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dados: any = {
        numeroProcesso: numeroFinal,
        parte,
        assunto: assuntoFinal,
        dataEntrada,
        observacoes: observacoes.trim() || null,
        setor,
        status: statusInicial,
        // IMPORTANTE: Preserva estado finalizado ao editar, força false ao criar novo
        finalizado: processo?.id ? (processo.status === "concluido") : false,
        criadoEm: processo?.id ? undefined : agora, // Não sobrescreve ao editar
        atualizadoEm: agora,
        // CRITICAL: Firestore rules require userId and userEmail for create permission
        userId: user!.uid,  // Garantido que existe pois modal só abre se logado
        userEmail: user!.email,  // Campo exigido pelas rules
        criadoPorNome: autorCadastro,
        criadoPorUid: autorIdCadastro,
        criadoPorEmail: autorEmailCadastro,
      };

      if (setor === "DU") {
        dados.origemDU = origemDU;
        dados.secaoDU = secaoDU;
        dados.isMS = isMS;
        dados.prazoInternoDU = prazoInternoDU || null;
        dados.prazoFatalDU = prazoFatalDU || null;
        dados.notificacaoAdminPendente = true;
        dados.notificacaoAdminEm = agoraISO;
        dados.notificacaoAdminPorNome = autorCadastro;
        dados.notificacaoAdminDescricao = "Novo processo DU aguardando distribuição.";

        if (processo?.id) {
          const numeroSaidaNormalizado = duNumeroSaida.trim();
          const numeroRecebidoNormalizado = duNumeroRecebido.trim();
          const numeroDocFinalNormalizado = duNumeroDocFinal.trim();
          const dataPrazoNormalizada = duDataPrazoFluxo.trim();
          const pedidoAtual = processo.pedidoSubsidios || {};
          const respostaAtual = processo.respostaDU || {};

          dados.pedidoSubsidios = {
            ...pedidoAtual,
            dataPrazo: dataPrazoNormalizada || null,
            prazoResposta: dataPrazoNormalizada || null,
            numeroSaida: numeroSaidaNormalizado || null,
            numeroDiex: numeroSaidaNormalizado || pedidoAtual.numeroDiex || null,
            numeroRecebido: numeroRecebidoNormalizado || null,
            numeroDocFinal: numeroDocFinalNormalizado || null,
          };

          dados.respostaDU = {
            ...respostaAtual,
            numeroDiex: numeroSaidaNormalizado || null,
            numeroRecebido: numeroRecebidoNormalizado || null,
            numeroOficio: numeroDocFinalNormalizado || null,
          };
        }
      }

      if (setor === "PA") {
        dados.tipoPA = tipoPA;
        dados.encarregado = encarregadoFinal;
        dados.isLegado = isSindicanciaAntiga;
        dados.fluxoIPM = (aceitaDiligencia(tipoPA) || isSindicanciaAntiga) ? fluxoIPM : null;
        dados.emDiligencia = isDiligenciaPA;
        dados.aguardandoAssinaturaCmt = !isSindicanciaAntiga;

        if (isSindicanciaPA) {
          dados.assuntoSindicancia = assuntoSindicancia;
          dados.especificidadesAssunto = especificidadesSindicancia;
        }

        if (isDiligenciaPA) {
          dados.primeiraPortaria = primeiraPortariaFormatada;
          dados.primeiroEncarregado = encarregadoPrimeiro;
          dados.mudouEncarregadoDiligencia = mudouEncarregado ? "Sim" : "Não";
          if (mudouEncarregado) dados.novaPortariaDiligencia = numeroFinal;
        }

        if (isConselhoPASelecionado) {
          dados.presidenteConselhoPosto = postoEncarregado;
          dados.presidenteConselhoNome = nomeEncarregado.trim();
          dados.omPresidenteConselho = omPresidenteConselho.trim();
        }

        if (processo?.id) {
          const dataInicioPAEditada = toDataCivil(dataInicioPrazoPA) || toDataCivil(processo.dataInicioPrazo || "");
          if (dataInicioPAEditada) {
            dados.dataInicioPrazo = dataInicioPAEditada;
          }

          const prorrogacoesBase = prorrogacoesEditaveis.map((item) => ({
            dias: Math.max(0, Math.trunc(Number(item.dias) || 0)),
            doc: (item.doc || "").trim() || "Documento não informado",
            inicio: toDataCivil(item.inicio) || undefined,
            fim: toDataCivil(item.fim) || undefined,
            em: item.em || undefined,
            por: item.por || undefined,
          }));

          const faixasRecalculadas = dataInicioPAEditada
            ? calcularFaixasProrrogacaoPA({
                tipoPA,
                dataInicioPrazo: dataInicioPAEditada,
                dataAssinatura: processo.dataAssinatura,
                prorrogacoes: prorrogacoesBase,
              })
            : [];

          const prorrogacoesNormalizadas = prorrogacoesBase.map((item, index) => ({
            ...item,
            inicio: faixasRecalculadas[index]?.inicio || item.inicio,
            fim: faixasRecalculadas[index]?.fim || item.fim,
          }));

          dados.prorrogacoes = prorrogacoesNormalizadas;

          const prazoCalculado = calcularPrazoFinalPA({
            tipoPA,
            dataInicioPrazo: dataInicioPAEditada || processo.dataInicioPrazo,
            dataAssinatura: processo.dataAssinatura,
            prorrogacoes: prorrogacoesNormalizadas,
          });

          if (prazoCalculado) {
            dados.prazoFatal = prazoCalculado;
            dados.finalPrazo = prazoCalculado;
          }
        }
      }

      if (processo?.id) {
        // console.log("✏️ EDITANDO PROCESSO EXISTENTE:", processo.id, "| Status atual:", processo.status, "| Finalizado:", processo.status === "concluido");
        const processoRef = doc(db, "processos", processo.id);
        const msgAtualizacao = "Dados do processo atualizados.";
        
        // Remove campos imutáveis do update (Firestore rules bloqueiam alteração desses campos)
        const { criadoEm: _, userId: _uid, userEmail: _email, criadoPorUid: _cpUid, criadoPorEmail: _cpEmail, ...dadosUpdate } = dados;
        
        await updateDoc(processoRef, { 
          ...dadosUpdate, 
          atualizadoEm: agora,
          atualizadoPorNome: autorCadastro,
          descricao: msgAtualizacao // Atualiza último movimento
        });

        const historicoCol = collection(db, "processos", processo.id, "historico");
        await addDoc(historicoCol, {
          autor: autorCadastro,
          autorId: autorIdCadastro,
          texto: msgAtualizacao,
          timestamp: agoraISO,
        });

        // Também salvar na coleção mensagens (compatibilidade sistema antigo)
        const mensagensRef = doc(db, "mensagens", processo.id);
        const mensagensSnap = await getDoc(mensagensRef);
        const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
        await setDoc(mensagensRef, {
          historico: [...historicoExistente, {
            id: crypto.randomUUID(),
            autor: autorCadastro,
            autorId: autorIdCadastro,
            texto: msgAtualizacao,
            timestamp: agoraISO,
          }]
        });

        toast.success("Processo atualizado com sucesso!");
      } else {
        const msgCadastro = `Processo Cadastrado por ${autorCadastro}.`;
        
        const msgFinal = msgCadastro;

        // Adiciona descricao ao documento principal
        dados.descricao = msgFinal;
        
        // console.log("📝 CRIANDO NOVO PROCESSO:", { setor, numeroProcesso, status: statusInicial });
        // console.log("📝 Responsável/Encarregado:", dados.encarregado || "(nenhum - aguardando distribuição)");
        // console.log("📝 Auth User:", { uid: user!.uid, email: user!.email });
        // console.log("📝 Dados que serão salvos no Firebase:", {
        //   userId: dados.userId,
        //   userEmail: dados.userEmail,
        //   setor: dados.setor,
        //   status: dados.status,
        //   numeroProcesso: dados.numeroProcesso
        // });
        
        const processoRef = await addDoc(collection(db, "processos"), dados);
        
        // console.log("✅ Processo criado com sucesso! ID:", processoRef.id);

        const historicoCol = collection(db, "processos", processoRef.id, "historico");
        await addDoc(historicoCol, {
          autor: autorCadastro,
          autorId: autorIdCadastro,
          texto: msgCadastro,
          timestamp: agoraISO,
        });

        // Também salvar na coleção mensagens (compatibilidade sistema antigo)
        await setDoc(doc(db, "mensagens", processoRef.id), {
          historico: [{
            id: crypto.randomUUID(),
            autor: autorCadastro,
            autorId: autorIdCadastro,
            texto: msgCadastro,
            timestamp: agoraISO,
          }]
        });

        if (setor === "PA") {
          let msgAdicional = "";
          if (isSindicanciaAntiga) {
            msgAdicional = `🗂️ Sindicância antiga cadastrada no acervo com a portaria ${numeroFinal}.`;

          // Atualizar também na coleção mensagens
          const mensagensRef = doc(db, "mensagens", processoRef.id);
          const mensagensSnap = await getDoc(mensagensRef);
          const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
          await setDoc(mensagensRef, {
            historico: [...historicoExistente, {
              id: crypto.randomUUID(),
              autor: autorCadastro,
              autorId: autorIdCadastro,
              texto: msgAdicional,
              timestamp: agoraISO,
            }]
          });
          } else if (isDiligenciaPA) {
            msgAdicional = `🔎 ${tipoPA} cadastrado em diligência${mudouEncarregado ? ` com nova portaria ${numeroFinal}` : " mantendo a mesma portaria"}. Aguardando assinatura do Cmt.`;
          } else {
            msgAdicional = "📋 Portaria cadastrada. Aguardando Assinatura do Cmt.";
          }
          await addDoc(historicoCol, {
            autor: autorCadastro,
            autorId: autorIdCadastro,
            texto: msgAdicional,
            timestamp: agoraISO,
          });
        }

        if (setor === "PA" && user) {
          await addDoc(collection(db, "distribuicoes"), {
            processoId: processoRef.id,
            assessorId: user.uid,
            assessorNome: autorCadastro,
            prazo: "",
            prioridade: "Normal",
            dataDistribuicao: agoraISO,
          });
        }

        toast.success(
          setor === "PA"
            ? (isSindicanciaAntiga ? "Sindicância antiga cadastrada no acervo!" : "PA Cadastrado e distribuído para a sua mesa!")
            : "Processo cadastrado com sucesso!"
        );
      }

      // console.log("✅ Cadastro concluído! Fechando modal...");
      onOpenChange(false);
      if (onSuccess) {
        // console.log("🔄 Notificando parent component para atualizar lista de processos...");
        onSuccess();
      }
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string; stack?: string };
      console.error("❌ ERRO ao salvar processo:", error);
      console.error("❌ Código do erro:", err?.code);
      console.error("❌ Mensagem:", err?.message);
      console.error("❌ Stack:", err?.stack);
      
      // Erro específico de permissão
      if (err?.code === "permission-denied") {
        console.error("🔒 ERRO DE PERMISSÃO FIRESTORE!");
        console.error("🔒 User UID:", user?.uid);
        console.error("🔒 User Email:", user?.email);
        toast.error("Sem permissão para criar processo. Verifique se o perfil deste usuário está salvo em /usuarios/{uid} com o setor correto.");
      } else {
        toast.error(`Erro ao salvar: ${err?.message || "Erro desconhecido"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const mostrarFluxoIPM = setor === "PA" && aceitaDiligencia(tipoPA);
  const mostrarEncarregado = setor === "PA" && aceitaDiligencia(tipoPA);
  const mostrarPresidenteConselho = setor === "PA" && isConselhoPA(tipoPA);
  const mostrarAnoLegado = setor === "PA" && tipoPA === "Sindicância" && fluxoIPM === "Sindicância Antigo";
  const mostrarMudancaEncarregado = setor === "PA" && aceitaDiligencia(tipoPA) && fluxoIPM === "Diligência";
  const mostrarAssuntoSindicancia = setor === "PA" && tipoPA === "Sindicância";

  // Debug: verifica estado do botão
  const botaoHabilitado = !(loading || !setor);
  // console.log("🔘 Estado do botão Submit:", { loading, setor, habilitado: botaoHabilitado });

  // Debug: log quando modal abre
  // if (open) {
  //   console.log("📂 Modal CadastroProcesso ABERTO", { setor, numeroProcesso, parte, user: user?.email });
  // }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{processo ? "Editar Processo" : "Cadastrar Processo"}</DialogTitle>
          <DialogDescription>
            {processo ? "Atualize as informações do processo." : "Preencha os dados para cadastrar um novo processo."}
          </DialogDescription>
        </DialogHeader>

        <form 
          onSubmit={(e) => {
            // console.log("📋 FORM onSubmit disparado! Event:", e.type);
            handleSubmit(e);
          }} 
          className="space-y-6"
        >
          {/* Setor */}
          <div className="space-y-2">
            <Label htmlFor="setor" className="uppercase text-xs font-bold">Setor *</Label>
            <Select 
              value={setor} 
              onValueChange={(v) => {
                // console.log("🔄 Setor selecionado:", v);
                setSetor(v as "DU" | "PA");
              }}
              disabled={!ehAdminOuChefe}
            >
              <SelectTrigger id="setor">
                <SelectValue placeholder="Selecione o Setor" />
              </SelectTrigger>
              <SelectContent>
                {podeCadastrarDU && (
                  <SelectItem value="DU">Defesa de Usuários (DU)</SelectItem>
                )}
                {podeCadastrarPA && (
                  <SelectItem value="PA">Processos Administrativos (PA)</SelectItem>
                )}
              </SelectContent>
            </Select>
            {!ehAdminOuChefe && (
              <p className="text-xs text-muted-foreground">
                Seu perfil permite cadastro apenas no setor {setorPadraoPermitido || "vinculado"}.
              </p>
            )}
          </div>

          {/* Tipo PA */}
          {setor === "PA" && (
            <div className="space-y-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
              <Label htmlFor="tipoPA" className="uppercase text-xs font-bold text-purple-900">
                Tipo de Procedimento (PA) *
              </Label>
              <Select value={tipoPA} onValueChange={setTipoPA}>
                <SelectTrigger id="tipoPA">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PA.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fluxo IPM */}
          {mostrarFluxoIPM && (
            <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
              <Label className="text-base font-semibold">Fluxo de {tipoPA || "Procedimento"}</Label>
              <RadioGroup value={fluxoIPM} onValueChange={(v) => setFluxoIPM(v as "Novo" | "Diligência" | "Sindicância Antigo")}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Novo" id="fluxo-novo" />
                  <Label htmlFor="fluxo-novo" className="font-normal cursor-pointer">Novo {tipoPA}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Diligência" id="fluxo-diligencia" />
                  <Label htmlFor="fluxo-diligencia" className="font-normal cursor-pointer">Diligência</Label>
                </div>
                {tipoPA === "Sindicância" && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Sindicância Antigo" id="fluxo-antigo" />
                    <Label htmlFor="fluxo-antigo" className="font-normal cursor-pointer">Sindicância Antiga (Acervo)</Label>
                  </div>
                )}
              </RadioGroup>
              {fluxoIPM === "Diligência" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {tipoPA || "Procedimento"} em diligência: após o cadastro o card volta para a mesa e o prazo é iniciado depois pelo assessor.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Ano Legado */}
          {mostrarAnoLegado && (
            <div className="space-y-2">
              <Label htmlFor="anoLegado">Ano da Sindicância Antiga *</Label>
              <Select value={anoLegado} onValueChange={setAnoLegado}>
                <SelectTrigger id="anoLegado">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {anosLegado.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Campos básicos - 2 colunas */}
          {setor && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numeroProcesso" className="uppercase text-xs font-semibold">
                    {labelNumeroProcesso()}
                  </Label>
                  <Input
                    id="numeroProcesso"
                    value={numeroProcesso}
                    onChange={(e) => setNumeroProcesso(e.target.value)}
                    placeholder={placeholderNumeroProcesso()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parte" className="uppercase text-xs font-semibold">
                    Parte / Interessado
                  </Label>
                  <Input
                    id="parte"
                    value={parte}
                    onChange={(e) => setParte(e.target.value)}
                    placeholder="Nome"
                  />
                </div>
              </div>
            </>
          )}

          {/* Assunto */}
          {setor && (
            mostrarAssuntoSindicancia ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="assuntoSindicancia">Assunto da Sindicância *</Label>
                <Select value={assuntoSindicancia} onValueChange={setAssuntoSindicancia}>
                  <SelectTrigger id="assuntoSindicancia">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assuntosPASindicancia.map((ass) => (
                      <SelectItem key={ass} value={ass}>{ass}</SelectItem>
                    ))}
                    {!!assuntoSindicancia && !assuntosPASindicancia.includes(assuntoSindicancia) && (
                      <SelectItem value={assuntoSindicancia}>{assuntoSindicancia}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="especificidades">Especificidades *</Label>
                <Textarea
                  id="especificidades"
                  value={especificidadesSindicancia}
                  onChange={(e) => setEspecificidadesSindicancia(e.target.value)}
                  placeholder="Detalhe as especificidades do assunto..."
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto *</Label>
              {setor === "DU" ? (
                <>
                  <Select value={assunto} onValueChange={setAssunto}>
                    <SelectTrigger id="assunto">
                      <SelectValue placeholder="Selecione o assunto principal" />
                    </SelectTrigger>
                    <SelectContent>
                      {assuntosDUPrincipais.map((ass) => (
                        <SelectItem key={ass} value={ass}>{ass}</SelectItem>
                      ))}
                      {!!assunto && !assuntosDUPrincipais.includes(assunto) && (
                        <SelectItem value={assunto}>{assunto}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Use Observações para registrar os detalhes específicos (ex.: PAD, pregão, evacuação, promoção).
                  </p>
                </>
              ) : (
                <Input
                  id="assunto"
                  value={assunto}
                  onChange={(e) => setAssunto(e.target.value)}
                  placeholder="Descreva o assunto do processo"
                />
              )}
            </div>
          )
          )}

          {/* Campos DU */}
          {setor === "DU" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origemDU">Origem *</Label>
                  <Select value={origemDU} onValueChange={setOrigemDU}>
                    <SelectTrigger id="origemDU">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {origensDUDocumentos.map((orig) => (
                        <SelectItem key={orig} value={orig}>{orig}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secaoDU">Seção</Label>
                  <Select value={secaoDU} onValueChange={setSecaoDU}>
                    <SelectTrigger id="secaoDU">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {secoesDU.map((sec) => (
                        <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isMS"
                  checked={isMS}
                  onCheckedChange={(checked) => setIsMS(checked as boolean)}
                />
                <Label htmlFor="isMS" className="font-normal cursor-pointer">É Mandado de Segurança / Urgente?</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prazoInternoDU">Prazo Interno</Label>
                  <Input
                    id="prazoInternoDU"
                    type="date"
                    value={prazoInternoDU}
                    onChange={(e) => setPrazoInternoDU(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prazoFatalDU">Prazo Fatal</Label>
                  <Input
                    id="prazoFatalDU"
                    type="date"
                    value={prazoFatalDU}
                    onChange={(e) => setPrazoFatalDU(e.target.value)}
                  />
                </div>
              </div>

              {processo?.id && (
                <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
                  <h4 className="text-sm font-semibold text-sky-900">Resultados DU</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duDataPrazoFluxo">Data de prazo (fluxo)</Label>
                      <Input
                        id="duDataPrazoFluxo"
                        type="date"
                        value={duDataPrazoFluxo}
                        onChange={(e) => setDuDataPrazoFluxo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duNumeroSaida">Nº envio/saída</Label>
                      <Input
                        id="duNumeroSaida"
                        value={duNumeroSaida}
                        onChange={(e) => setDuNumeroSaida(e.target.value)}
                        placeholder="Ex: DIEx 123/2026"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duNumeroRecebido">Nº documento recebido</Label>
                      <Input
                        id="duNumeroRecebido"
                        value={duNumeroRecebido}
                        onChange={(e) => setDuNumeroRecebido(e.target.value)}
                        placeholder="Ex: DIEx 456/2026"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duNumeroDocFinal">Nº documento final</Label>
                      <Input
                        id="duNumeroDocFinal"
                        value={duNumeroDocFinal}
                        onChange={(e) => setDuNumeroDocFinal(e.target.value)}
                        placeholder="Ex: Ofício 789/2026"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Encarregado PA */}
          {mostrarEncarregado && (
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
              <h4 className="font-semibold text-sm">
                {fluxoIPM === "Diligência" ? "Encarregado da 1ª Portaria" : "Encarregado"}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postoEncarregado">Posto *</Label>
                  <Select value={postoEncarregado} onValueChange={setPostoEncarregado}>
                    <SelectTrigger id="postoEncarregado">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTOS_ENCARREGADO.map((posto) => (
                        <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeEncarregado">Nome *</Label>
                  <Input
                    id="nomeEncarregado"
                    value={nomeEncarregado}
                    onChange={(e) => setNomeEncarregado(e.target.value)}
                    placeholder="Ex: Portela"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Presidente do Conselho (CD/CJ) */}
          {mostrarPresidenteConselho && (
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
              <h4 className="font-semibold text-sm">Presidente do Conselho</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postoPresidenteConselho">Posto *</Label>
                  <Select value={postoEncarregado} onValueChange={setPostoEncarregado}>
                    <SelectTrigger id="postoPresidenteConselho">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTOS_CONSELHO.map((posto) => (
                        <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomePresidenteConselho">Nome *</Label>
                  <Input
                    id="nomePresidenteConselho"
                    value={nomeEncarregado}
                    onChange={(e) => setNomeEncarregado(e.target.value)}
                    placeholder="Ex: Portela"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="omPresidenteConselho">OM do Presidente *</Label>
                <Input
                  id="omPresidenteConselho"
                  value={omPresidenteConselho}
                  onChange={(e) => setOmPresidenteConselho(e.target.value)}
                  placeholder="Ex: 12ª RM, 1º BIS, 4ª Cia Com"
                />
              </div>
            </div>
          )}

          {/* Mudança de Encarregado */}
          {mostrarMudancaEncarregado && (
            <div className="space-y-4 p-4 border rounded-lg bg-amber-50">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="mudouEncarregado"
                  checked={mudouEncarregado}
                  onCheckedChange={(checked) => setMudouEncarregado(checked as boolean)}
                />
                <Label htmlFor="mudouEncarregado" className="font-normal cursor-pointer">Houve mudança de encarregado?</Label>
              </div>

              {mudouEncarregado && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postoEncarregadoAtual">Posto Atual *</Label>
                      <Select value={postoEncarregadoAtual} onValueChange={setPostoEncarregadoAtual}>
                        <SelectTrigger id="postoEncarregadoAtual">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {POSTOS_ENCARREGADO.map((posto) => (
                            <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nomeEncarregadoAtual">Nome Atual *</Label>
                      <Input
                        id="nomeEncarregadoAtual"
                        value={nomeEncarregadoAtual}
                        onChange={(e) => setNomeEncarregadoAtual(e.target.value)}
                        placeholder="Ex: Becker"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="novaPortaria">Nova Portaria *</Label>
                    <Input
                      id="novaPortaria"
                      value={novaPortaria}
                      onChange={(e) => setNovaPortaria(e.target.value)}
                      placeholder="Ex: Portaria Nr 13/2026"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {setor && (
            <>
              {processo?.id && setor === "PA" && (
                <div className="space-y-2 p-4 border rounded-lg bg-sky-50 border-sky-200">
                  <Label htmlFor="dataInicioPrazoPA" className="text-sm font-semibold text-sky-900">
                    Data inicial da contagem do prazo
                  </Label>
                  <Input
                    id="dataInicioPrazoPA"
                    type="date"
                    value={dataInicioPrazoPA}
                    onChange={(e) => setDataInicioPrazoPA(e.target.value)}
                  />
                  <p className="text-xs text-sky-800">
                    Ao alterar esta data, o prazo final e as faixas de prorrogação são recalculados automaticamente.
                  </p>
                </div>
              )}

              {processo?.id && setor === "PA" && (
                <div className="space-y-3 p-4 border rounded-lg bg-amber-50 border-amber-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-amber-900">Prorrogações (editar início e fim)</h4>
                    <Button type="button" variant="outline" className="border-amber-300 text-amber-800" onClick={adicionarProrrogacaoEditavel}>
                      + Nova prorrogação
                    </Button>
                  </div>

                  {prorrogacoesEditaveis.length === 0 ? (
                    <p className="text-xs text-amber-800">Sem prorrogações registradas.</p>
                  ) : (
                    <div className="space-y-3">
                      {prorrogacoesEditaveis.map((item, index) => (
                        <div key={`prorrogacao-edit-${index}`} className="rounded-md border border-amber-200 bg-white p-3 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Documento</Label>
                              <Input
                                value={item.doc}
                                onChange={(e) => atualizarProrrogacao(index, "doc", e.target.value)}
                                placeholder="Documento concessório"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Dias</Label>
                              <Input
                                type="number"
                                min={0}
                                value={item.dias}
                                onChange={(e) => atualizarProrrogacao(index, "dias", e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs">Início da prorrogação</Label>
                              <Input
                                type="date"
                                value={item.inicio}
                                onChange={(e) => atualizarProrrogacao(index, "inicio", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Fim da prorrogação</Label>
                              <Input
                                type="date"
                                value={item.fim}
                                onChange={(e) => atualizarProrrogacao(index, "fim", e.target.value)}
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full border-red-300 text-red-700"
                                onClick={() => removerProrrogacaoEditavel(index)}
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-amber-900">
                    Regra: a contagem da prorrogação começa na data em que termina o prazo anterior.
                  </p>
                </div>
              )}

              {/* Data de Entrada */}
              <div className="space-y-2">
                <Label htmlFor="dataEntrada" className="uppercase text-xs font-semibold">Data de Entrada *</Label>
                <Input
                  id="dataEntrada"
                  type="date"
                  value={dataEntrada}
                  onChange={(e) => setDataEntrada(e.target.value)}
                />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes" className="uppercase text-xs font-semibold">Observações / Informações Iniciais</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder={setor === "DU" ? "Detalhe aqui o caso específico do assunto DU selecionado..." : "Informações relevantes sobre o processo..."}
                  rows={3}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                // console.log("❌ Botão CANCELAR clicado");
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !setor}
              // onMouseDown={() => console.log("👇 MouseDOWN no SALVAR", { setor, loading })}
              // onMouseUp={() => console.log("👆 MouseUP no SALVAR")}
              onClick={(e) => {
                // console.log("🖱️ ONCLICK SALVAR DISPARADO!", { 
                //   loading, 
                //   setor,
                //   disabled: loading || !setor,
                //   defaultPrevented: e.defaultPrevented 
                // });
              }}
            >
              {loading ? "Salvando..." : (processo ? "Atualizar" : "Salvar Processo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Log quando componente é renderizado
// console.log("🎨 CadastroProcessoModal renderizado");
