import { useState, useEffect } from "react";
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
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CadastroProcessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo?: Processo | null;
  onSuccess?: () => void;
}

const TIPOS_PA = ["IPM", "Sindicância", "Conselho de Disciplina", "Conselho de Justificação", "Investigação Preliminar", "Outros"];
const ASSUNTOS_SINDICANCIA = ["Falta Injustificada", "Embriaguez", "Deserção", "Outros"];
const ORIGENS_DU = ["SAPIENS", "Ofício", "E-mail", "Whatsapp", "Presencial", "Outros"];
const SECOES_DU = ["SVP", "SFPC", "DIVADM", "APG", "PMM", "OUTROS"];

// LOG DE VERIFICAÇÃO - ESTE LOG DEVE APARECER SEMPRE
// console.log("🚀🚀🚀 ARQUIVO CadastroProcessoModal.tsx CARREGADO - VERSÃO NOVA COM LOGS! 🚀🚀🚀");

export function CadastroProcessoModal({ open, onOpenChange, processo, onSuccess }: CadastroProcessoModalProps) {
  const { user } = useAuth();
  
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

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTimeout(resetForm, 300);
    } else if (processo) {
      preencherParaEdicao(processo);
    } else {
      resetForm();
    }
  }, [open, processo]);

  const resetForm = () => {
    setSetor("");
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
    }

    if (p.setor === "PA") {
      setTipoPA(p.tipoPA || "");
      
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
    }
  };

  const aceitaDiligencia = (tipo: string) => {
    const norm = tipo.toLowerCase();
    return norm.includes("ipm") || norm.includes("sindic") || norm.includes("conselho");
  };

  const formatarPortaria = (valor: string) => {
    const texto = valor.trim();
    if (!texto) return "";
    return /^portaria/i.test(texto) ? texto : `Portaria Nr ${texto}`;
  };

  const anosLegado = Array.from({ length: 4 }, (_, idx) => new Date().getFullYear() - 4 + idx);

  const labelNumeroProcesso = () => {
    if (setor === "DU") return "NUP / SAPIENS / Nº Documento";
    if (setor === "PA") {
      const isSindicanciaAntiga = tipoPA === "Sindicância" && fluxoIPM === "Sindicância Antigo";
      const isDiligencia = aceitaDiligencia(tipoPA) && fluxoIPM === "Diligência";
      if (isSindicanciaAntiga) return "Número da Portaria Antiga";
      if (isDiligencia) return "1ª Portaria / Ano";
      if (aceitaDiligencia(tipoPA)) return "Número da Portaria / Ano";
    }
    return "Número do Processo";
  };

  const placeholderNumeroProcesso = () => {
    if (setor === "DU") return "Ex: 0001234-56...";
    if (setor === "PA") {
      const isSindicanciaAntiga = tipoPA === "Sindicância" && fluxoIPM === "Sindicância Antigo";
      if (isSindicanciaAntiga) return "Ex: 12";
      if (aceitaDiligencia(tipoPA)) return "Ex: Portaria Nr 12/2026";
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
    if (!numeroProcesso.trim()) {
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
      toast.error("Preencha o assunto do processo.");
      return;
    }

    // console.log("✅ Todas validações passaram! Prosseguindo...");
    
    const isSindicanciaPA = setor === "PA" && tipoPA === "Sindicância";
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

    // console.log("🚀 Iniciando cadastro no Firebase...");
    setLoading(true);

    try {
      const agora = Timestamp.now();
      const agoraISO = new Date().toISOString();

      // Assunto final
      const assuntoFinal = isSindicanciaPA
        ? `${assuntoSindicancia}${especificidadesSindicancia ? ` - ${especificidadesSindicancia}` : ""}`
        : assunto;

      // Número da portaria
      const valorBasePortaria = isSindicanciaAntiga && anoLegado ? `${numeroProcesso}/${anoLegado}` : numeroProcesso;
      const primeiraPortariaFormatada = (setor === "PA" && (aceitaDiligencia(tipoPA) || isSindicanciaAntiga))
        ? formatarPortaria(valorBasePortaria)
        : numeroProcesso;
      const numeroFinal = (mudouEncarregado && novaPortaria) ? formatarPortaria(novaPortaria) : primeiraPortariaFormatada;

      // Encarregado
      const encarregadoPrimeiro = `${postoEncarregado} ${nomeEncarregado}`.trim() || null;
      const encarregadoAtualInformado = `${postoEncarregadoAtual} ${nomeEncarregadoAtual}`.trim() || null;
      const encarregadoFinal = (isDiligenciaPA && mudouEncarregado) ? encarregadoAtualInformado : encarregadoPrimeiro;

      // Status inicial
      let statusInicial = "Aguardando Distribuição";
      if (setor === "PA") {
        if (isSindicanciaAntiga) statusInicial = "Atrasado";
        else if (isDiligenciaPA) statusInicial = "Diligência";
        else statusInicial = "Distribuído";
      }

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
        criadoPorNome: user?.email || null,  // Campo adicional para compatibilidade
      };

      if (setor === "DU") {
        dados.origemDU = origemDU;
        dados.secaoDU = secaoDU;
        dados.isMS = isMS;
        dados.prazoInternoDU = prazoInternoDU || null;
        dados.prazoFatalDU = prazoFatalDU || null;
        dados.notificacaoAdminPendente = true;
        dados.notificacaoAdminEm = agoraISO;
        dados.notificacaoAdminPorNome = user?.email || null;
        dados.notificacaoAdminDescricao = "Novo processo DU aguardando distribuição.";
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
      }

      if (processo?.id) {
        // console.log("✏️ EDITANDO PROCESSO EXISTENTE:", processo.id, "| Status atual:", processo.status, "| Finalizado:", processo.status === "concluido");
        const processoRef = doc(db, "processos", processo.id);
        const msgAtualizacao = "Dados do processo atualizados.";
        
        // Remove criadoEm do update para não sobrescrever
        const { criadoEm: _, ...dadosUpdate } = dados;
        
        await updateDoc(processoRef, { 
          ...dadosUpdate, 
          atualizadoEm: agora,
          atualizadoPorNome: user?.email || "Sistema",
          descricao: msgAtualizacao // Atualiza último movimento
        });

        const historicoCol = collection(db, "processos", processo.id, "historico");
        await addDoc(historicoCol, {
          autor: user?.email || "Sistema",
          autorId: user?.uid || "sistema",
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
            autor: user?.email || "Sistema",
            autorId: user?.uid || "sistema",
            texto: msgAtualizacao,
            timestamp: agoraISO,
          }]
        });

        toast.success("Processo atualizado com sucesso!");
      } else {
        const msgCadastro = (setor === "DU" && isMS)
          ? "🚨 Mandado de Segurança / Urgente cadastrado no sistema."
          : (setor === "PA" ? `Processo cadastrado e atribuído a ${user?.email}.` : "Process cadastrado no sistema.");
        
        const msgFinal = setor === "PA" 
          ? (isSindicanciaAntiga 
              ? `🗂️ Sindicância antiga cadastrada no acervo com a portaria ${numeroFinal}.`
              : (isDiligenciaPA
                  ? `🔎 ${tipoPA} cadastrado em diligência${mudouEncarregado ? ` com nova portaria ${numeroFinal}` : " mantendo a mesma portaria"}. Aguardando assinatura do Cmt.`
                  : "📋 Portaria cadastrada. Aguardando Assinatura do Cmt."))
          : msgCadastro;

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
          autor: "Sistema",
          autorId: "sistema",
          texto: msgCadastro,
          timestamp: agoraISO,
        });

        // Também salvar na coleção mensagens (compatibilidade sistema antigo)
        await setDoc(doc(db, "mensagens", processoRef.id), {
          historico: [{
            id: crypto.randomUUID(),
            autor: "Sistema",
            autorId: "sistema",
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
              autor: "Sistema",
              autorId: "sistema",
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
            autor: "Sistema",
            autorId: "sistema",
            texto: msgAdicional,
            timestamp: agoraISO,
          });
        }

        if (setor === "PA" && user) {
          await addDoc(collection(db, "distribuicoes"), {
            processoId: processoRef.id,
            assessorId: user.uid,
            assessorNome: user.email,
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
    } catch (error: any) {
      console.error("❌ ERRO ao salvar processo:", error);
      console.error("❌ Código do erro:", error?.code);
      console.error("❌ Mensagem:", error?.message);
      console.error("❌ Stack:", error?.stack);
      
      // Erro específico de permissão
      if (error?.code === "permission-denied") {
        console.error("🔒 ERRO DE PERMISSÃO FIRESTORE!");
        console.error("🔒 User UID:", user?.uid);
        console.error("🔒 User Email:", user?.email);
        toast.error("Sem permissão para criar processo. Verifique se está logado corretamente.");
      } else {
        toast.error(`Erro ao salvar: ${error?.message || "Erro desconhecido"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const mostrarFluxoIPM = setor === "PA" && aceitaDiligencia(tipoPA);
  const mostrarEncarregado = setor === "PA" && aceitaDiligencia(tipoPA);
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
            >
              <SelectTrigger id="setor">
                <SelectValue placeholder="Selecione o Setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DU">Defesa de Usuários (DU)</SelectItem>
                <SelectItem value="PA">Processos Administrativos (PA)</SelectItem>
              </SelectContent>
            </Select>
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
              <RadioGroup value={fluxoIPM} onValueChange={(v) => setFluxoIPM(v as any)}>
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
                    {ASSUNTOS_SINDICANCIA.map((ass) => (
                      <SelectItem key={ass} value={ass}>{ass}</SelectItem>
                    ))}
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
              <Input
                id="assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Descreva o assunto do processo"
              />
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
                      {ORIGENS_DU.map((orig) => (
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
                      {SECOES_DU.map((sec) => (
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
                  <Input
                    id="postoEncarregado"
                    value={postoEncarregado}
                    onChange={(e) => setPostoEncarregado(e.target.value)}
                    placeholder="Ex: Ten"
                  />
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
                      <Input
                        id="postoEncarregadoAtual"
                        value={postoEncarregadoAtual}
                        onChange={(e) => setPostoEncarregadoAtual(e.target.value)}
                        placeholder="Ex: Ten"
                      />
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
                  placeholder="Informações relevantes sobre o processo..."
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
