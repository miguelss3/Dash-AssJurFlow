import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UltimoPedidoSubsidios = {
  tipoSolicitacao?: "primeira_vez" | "reiteracao";
  tipoDestino?: "interno" | "externo";
  secaoInterna?: string;
  omExterna?: string;
  numeroDiex?: string;
  numeroDiexHistorico?: string[];
  prazoResposta?: string;
  observacoes?: string;
  situacaoFluxo?: string;
  reiteracoes?: number;
};

interface AcoesDUModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onSuccess?: () => void;
}

export function AcoesDUModalNovo({ open, onOpenChange, processoId, numeroProcesso, onSuccess }: AcoesDUModalNovoProps) {
  const { user } = useAuth();
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;
  const [acaoSelecionada, setAcaoSelecionada] = useState<string | null>(null);
  
  // Estados para Solicitar Subsídios
  const [tipoSolicitacaoSubsidio, setTipoSolicitacaoSubsidio] = useState<"primeira_vez" | "reiteracao">("primeira_vez");
  const [tipoPedidoSubsidio, setTipoPedidoSubsidio] = useState<"interno" | "externo">("interno");
  const [secaoInterna, setSecaoInterna] = useState("");
  const [omExterna, setOMExterna] = useState("");
  const [numeroDiex, setNumeroDiex] = useState("");
  const [dieuxAnteriores, setDieuxAnteriores] = useState<string[]>([]);
  const [prazoResposta, setPrazoResposta] = useState("");
  const [observacoesSubsidio, setObservacoesSubsidio] = useState("");
  
  // Estados para Registrar Resposta
  const [numeroOficio, setNumeroOficio] = useState("");
  const [numeroDiexResposta, setNumeroDiexResposta] = useState("");
  const [destinoDocumentoResposta, setDestinoDocumentoResposta] = useState("");
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split("T")[0]);
  const [observacoesResposta, setObservacoesResposta] = useState("");
  const [tipoDestinoAtual, setTipoDestinoAtual] = useState<"interno" | "externo" | "">("");
  const [situacaoFluxoAtual, setSituacaoFluxoAtual] = useState("");
  const [ultimoPedidoSubsidios, setUltimoPedidoSubsidios] = useState<UltimoPedidoSubsidios | null>(null);

  useEffect(() => {
    if (!open || !processoId) return;

    const carregarContexto = async () => {
      try {
        const processoRef = doc(db, "processos", processoId);
        const snap = await getDoc(processoRef);
        if (!snap.exists()) return;
        const pedido = snap.data()?.pedidoSubsidios || {};
        setTipoDestinoAtual((pedido.tipoDestino as "interno" | "externo") || "");
        setSituacaoFluxoAtual((pedido.situacaoFluxo as string) || "");
        setUltimoPedidoSubsidios(pedido as UltimoPedidoSubsidios);
      } catch (error) {
        console.error("Erro ao carregar contexto de subsídios:", error);
      }
    };

    carregarContexto();
  }, [open, processoId]);

  const resetFormularios = () => {
    setAcaoSelecionada(null);
    setTipoSolicitacaoSubsidio("primeira_vez");
    setTipoPedidoSubsidio("interno");
    setSecaoInterna("");
    setOMExterna("");
    setNumeroDiex("");
    setDieuxAnteriores([]);
    setPrazoResposta("");
    setObservacoesSubsidio("");
    setNumeroOficio("");
    setNumeroDiexResposta("");
    setDestinoDocumentoResposta("");
    setDataEnvio(new Date().toISOString().split("T")[0]);
    setObservacoesResposta("");
  };

  const extrairDiexAnteriores = (pedidoAnterior: any, respostaDUAnterior: any): string[] => {
    const candidatos = [
      ...(Array.isArray(pedidoAnterior?.numeroDiexHistorico) ? pedidoAnterior.numeroDiexHistorico : []),
      pedidoAnterior?.numeroDiex,
      respostaDUAnterior?.numeroDiex,
    ]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);

    return Array.from(new Set(candidatos));
  };

  const mergeDiexHistorico = (pedidoAtual: any, novoDiex?: string): string[] => {
    const base = Array.isArray(pedidoAtual?.numeroDiexHistorico) ? pedidoAtual.numeroDiexHistorico : [];
    const candidatos = [
      ...base,
      pedidoAtual?.numeroDiex,
      novoDiex,
    ]
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);

    return Array.from(new Set(candidatos));
  };

  const handleSolicitarSubsidios = async () => {
    if (!processoId || !user) return;

    const processoRef = doc(db, "processos", processoId);
    const processoSnap = await getDoc(processoRef);
    const pedidoAnterior = processoSnap.exists() ? (processoSnap.data()?.pedidoSubsidios || {}) : {};
    const respostaDUAnterior = processoSnap.exists() ? (processoSnap.data()?.respostaDU || {}) : {};

    if (tipoSolicitacaoSubsidio === "reiteracao" && !pedidoAnterior?.tipoDestino) {
      toast.error("Não existe solicitação anterior para reiterar.");
      return;
    }

    const tipoDestinoEfetivo: "interno" | "externo" =
      tipoSolicitacaoSubsidio === "reiteracao"
        ? (pedidoAnterior.tipoDestino as "interno" | "externo")
        : tipoPedidoSubsidio;

    const secaoInternaEfetiva =
      tipoSolicitacaoSubsidio === "reiteracao"
        ? (pedidoAnterior.secaoInterna || "")
        : secaoInterna;

    const omExternaEfetiva =
      tipoSolicitacaoSubsidio === "reiteracao"
        ? (pedidoAnterior.omExterna || "")
        : omExterna;

    const diexHistorico = extrairDiexAnteriores(pedidoAnterior, respostaDUAnterior);
    setDieuxAnteriores(diexHistorico);

    if (tipoDestinoEfetivo === "interno" && !secaoInternaEfetiva.trim()) {
      toast.error("Informe a seção interna.");
      return;
    }
    if (tipoDestinoEfetivo === "externo" && !omExternaEfetiva.trim()) {
      toast.error("Informe a OM externa.");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const situacaoFluxo = tipoDestinoEfetivo === "interno"
        ? "aguardando_assinatura_secao"
        : "aguardando_aprovacao_externa";
      const statusFluxo = tipoDestinoEfetivo === "interno"
        ? "Aguardando Assinatura da Seção"
        : "Aguardando Aprovação Externa";

      const pedidoSubsidios = {
        tipoSolicitacao: tipoSolicitacaoSubsidio,
        tipoDestino: tipoDestinoEfetivo,
        secaoInterna: tipoDestinoEfetivo === "interno" ? secaoInternaEfetiva : "",
        omExterna: tipoDestinoEfetivo === "externo" ? omExternaEfetiva : "",
        numeroDiex: numeroDiex.trim() || "",
        numeroDiexHistorico: diexHistorico,
        prazoResposta: prazoResposta || "",
        observacoes: observacoesSubsidio.trim() || "",
        situacaoFluxo,
        solicitadoEm: agoraISO,
        solicitadoPorNome: autorMilitar,
        reiteracoes: tipoSolicitacaoSubsidio === "reiteracao"
          ? (pedidoAnterior?.reiteracoes || 0) + 1
          : 0,
      };

      const prefixo = tipoSolicitacaoSubsidio === "reiteracao" ? "🔁 Reiteração" : "📨 Solicitação";
      const msgHistorico = tipoDestinoEfetivo === "interno"
        ? `${prefixo} de subsídios internos para ${secaoInternaEfetiva}. Aguardando assinatura da seção e devolução com DIEx.`
        : `${prefixo} de subsídios externos para ${omExternaEfetiva}. Aguardando aprovação externa e posterior assinatura do CHEM.`;

      await updateDoc(processoRef, {
        pedidoSubsidios,
        status: statusFluxo,
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });

      // Adicionar ao histórico (subcoleção)
      const historicoRef = collection(db, `processos/${processoId}/historico`);
      await addDoc(historicoRef, {
        autor: autorMilitar,
        autorId: user.uid,
        texto: msgHistorico,
        timestamp: agoraISO,
      });

      // Também salvar na coleção mensagens (compatibilidade)
      const mensagensRef = doc(db, "mensagens", processoId);
      const mensagensSnap = await getDoc(mensagensRef);
      const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
      await setDoc(mensagensRef, {
        historico: [...historicoExistente, {
          id: crypto.randomUUID(),
          autor: autorMilitar,
          autorId: user.uid,
          texto: msgHistorico,
          timestamp: agoraISO,
        }]
      });

      toast.success(tipoSolicitacaoSubsidio === "reiteracao" ? "Reiteração enviada!" : "Pedido de subsídios enviado!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao solicitar subsídios:", error);
      toast.error("Erro ao enviar pedido de subsídios");
    }
  };

  const handleRegistrarResposta = async () => {
    if (!processoId || !user) return;

    if (!destinoDocumentoResposta.trim()) {
      toast.error("Informe o destino do documento.");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);
      const processoSnap = await getDoc(processoRef);
      const pedidoSubsidiosAtual = processoSnap.exists() ? (processoSnap.data()?.pedidoSubsidios || {}) : {};
      const tipoDestinoAtual = pedidoSubsidiosAtual?.tipoDestino as "interno" | "externo" | undefined;
      const isChefiaProcessandoPedido = isAdmin(user) && ["aguardando_assinatura_secao", "aguardando_aprovacao_externa", "enviado_admin"].includes(pedidoSubsidiosAtual?.situacaoFluxo || "");
      const aguardandoAssinaturaCHEM = !isAdmin(user) && tipoDestinoAtual === "externo" && ["aprovado_externo_enviado_chem", "aprovado_externo_aguardando_chem"].includes(pedidoSubsidiosAtual?.situacaoFluxo || "");

      if (aguardandoAssinaturaCHEM && !numeroOficio.trim() && !numeroDiexResposta.trim()) {
        toast.error("Informe Ofício, DIEx ou ambos após a assinatura do CHEM.");
        return;
      }

      const respostaDU = {
        numeroOficio: numeroOficio.trim() || "",
        numeroDiex: numeroDiexResposta.trim() || "",
        destinoDocumento: destinoDocumentoResposta.trim(),
        dataEnvio,
        observacoes: observacoesResposta.trim() || "",
        situacao: aguardandoAssinaturaCHEM ? "assinada_chem" : (isAdmin(user) ? "processada_chefia" : "enviada_chefia"),
        registradoEm: agoraISO,
        registradoPorNome: autorMilitar,
      };

      let msgHistorico = `📤 Resposta enviada à chefia (Ofício: ${numeroOficio || "—"}, DIEx: ${numeroDiexResposta || "—"}, Destino: ${destinoDocumentoResposta.trim()}) por ${autorMilitar}.`;
      let statusDestino = isAdmin(user) ? "Aguardando Assinatura do CHEM" : "Aguardando Conferência da Chefia";
      let patchPedidoSubsidios: any = null;

      if (isChefiaProcessandoPedido && tipoDestinoAtual === "interno") {
        msgHistorico = `✅ Pedido interno assinado pela chefia e devolvido ao assessor com DIEx ${numeroDiexResposta || "—"}.`;
        statusDestino = "Em Andamento";
        patchPedidoSubsidios = {
          ...pedidoSubsidiosAtual,
          numeroDiex: numeroDiexResposta.trim() || pedidoSubsidiosAtual?.numeroDiex || "",
          numeroDiexHistorico: mergeDiexHistorico(pedidoSubsidiosAtual, numeroDiexResposta.trim()),
          situacaoFluxo: "devolvido_assessor_interno",
          assinadoChefiaEm: agoraISO,
          assinadoChefiaPorNome: autorMilitar,
        };
      } else if (isChefiaProcessandoPedido && tipoDestinoAtual === "externo") {
        msgHistorico = "✅ Chefe da AssJur conferiu, aprovou e enviou ao CHEM. Card devolvido ao assessor aguardando assinatura do CHEM no SPED.";
        statusDestino = "Aguardando Assinatura do CHEM";
        patchPedidoSubsidios = {
          ...pedidoSubsidiosAtual,
          numeroDiex: "",
          numeroDiexHistorico: mergeDiexHistorico(pedidoSubsidiosAtual),
          situacaoFluxo: "aprovado_externo_enviado_chem",
          aprovadoChefiaEm: agoraISO,
          aprovadoChefiaPorNome: autorMilitar,
        };
      } else if (aguardandoAssinaturaCHEM) {
        msgHistorico = `✅ Assessor registrou os números após a assinatura do CHEM (Ofício: ${numeroOficio || "—"}, DIEx: ${numeroDiexResposta || "—"}). Processo liberado para finalização.`;
        statusDestino = "Aguardando Finalização DU";
        patchPedidoSubsidios = {
          ...pedidoSubsidiosAtual,
          numeroDiex: numeroDiexResposta.trim() || pedidoSubsidiosAtual?.numeroDiex || "",
          numeroDiexHistorico: mergeDiexHistorico(pedidoSubsidiosAtual, numeroDiexResposta.trim()),
          situacaoFluxo: "resposta_assinada_chem",
          dataAssinatura: dataEnvio || pedidoSubsidiosAtual?.dataAssinatura || "",
        };
      }

      const updatePayload: any = {
        respostaDU,
        status: statusDestino,
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      };
      if (patchPedidoSubsidios) {
        updatePayload.pedidoSubsidios = patchPedidoSubsidios;
      }

      await updateDoc(processoRef, updatePayload);

      // Adicionar ao histórico (subcoleção)
      const historicoRef = collection(db, `processos/${processoId}/historico`);
      await addDoc(historicoRef, {
        autor: autorMilitar,
        autorId: user.uid,
        texto: msgHistorico,
        timestamp: agoraISO,
      });

      // Também salvar na coleção mensagens (compatibilidade)
      const mensagensRef = doc(db, "mensagens", processoId);
      const mensagensSnap = await getDoc(mensagensRef);
      const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
      await setDoc(mensagensRef, {
        historico: [...historicoExistente, {
          id: crypto.randomUUID(),
          autor: autorMilitar,
          autorId: user.uid,
          texto: msgHistorico,
          timestamp: agoraISO,
        }]
      });

      toast.success("Resposta registrada com sucesso!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao registrar resposta:", error);
      toast.error("Erro ao registrar resposta");
    }
  };

  const handleDespacharCHEM = async () => {
    if (!processoId || !user || !isAdmin(user)) return;

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);
      const processoSnap = await getDoc(processoRef);
      const pedidoAtual = processoSnap.exists() ? (processoSnap.data()?.pedidoSubsidios || {}) : {};
      const respostaAtual = processoSnap.exists() ? (processoSnap.data()?.respostaDU || {}) : {};

      const numeroOficioAtual = (respostaAtual?.numeroOficio || "").toString().trim();
      const numeroDiexAtual = (respostaAtual?.numeroDiex || "").toString().trim();
      const destinoAtual = (respostaAtual?.destinoDocumento || "").toString().trim();

      if (!numeroOficioAtual && !numeroDiexAtual) {
        toast.error("Registre Ofício ou DIEx na resposta antes de confirmar assinatura CHEM.");
        return;
      }
      if (!destinoAtual) {
        toast.error("Informe o destino do documento antes de confirmar assinatura CHEM.");
        return;
      }

      const msgHistorico = `✅ Resposta assinada pelo CHEM. Processo liberado para finalização definitiva por ${user.email?.split("@")[0]}.`;

      await updateDoc(processoRef, {
        respostaDU: {
          ...respostaAtual,
          situacao: "assinada_chem",
          registradoEm: respostaAtual?.registradoEm || agoraISO,
          registradoPorNome: respostaAtual?.registradoPorNome || autorMilitar,
        },
        pedidoSubsidios: {
          ...pedidoAtual,
          situacaoFluxo: "resposta_assinada_chem",
        },
        status: "Aguardando Finalização DU",
        finalizado: false,
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: user.email || "Sistema",
      });

      // Adicionar ao histórico
      const historicoRef = collection(db, `processos/${processoId}/historico`);
      await addDoc(historicoRef, {
        autor: autorMilitar,
        autorId: user.uid,
        texto: msgHistorico,
        timestamp: agoraISO,
      });

      // Também salvar na coleção mensagens
      const mensagensRef = doc(db, "mensagens", processoId);
      const mensagensSnap = await getDoc(mensagensRef);
      const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
      await setDoc(mensagensRef, {
        historico: [...historicoExistente, {
          id: crypto.randomUUID(),
          autor: autorMilitar,
          autorId: user.uid,
          texto: msgHistorico,
          timestamp: agoraISO,
        }]
      });

      toast.success("Despacho CHEM registrado!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao despachar CHEM:", error);
      toast.error("Erro ao registrar despacho");
    }
  };

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
      historico: [...historicoExistente, {
        id: crypto.randomUUID(),
        autor: autorMilitar,
        autorId: user?.uid || "sistema",
        texto,
        timestamp: agoraISO,
      }]
    });
  };

  const handleAssinarDiexChefia = async () => {
    if (!processoId || !user || !isAdmin(user)) return;
    if (!numeroDiexResposta.trim()) {
      toast.error("Informe o número do DIEx para assinar.");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);
      const processoSnap = await getDoc(processoRef);
      const pedidoAtual = processoSnap.exists() ? (processoSnap.data()?.pedidoSubsidios || {}) : {};

      const msgHistorico = `✅ Assinatura do Chefe de Seção concluída. Processo devolvido ao assessor com DIEx ${numeroDiexResposta.trim()}.`;

      await updateDoc(processoRef, {
        pedidoSubsidios: {
          ...pedidoAtual,
          numeroDiex: numeroDiexResposta.trim(),
          numeroDiexHistorico: mergeDiexHistorico(pedidoAtual, numeroDiexResposta.trim()),
          situacaoFluxo: "devolvido_assessor_com_diex",
          assinadoChefiaEm: agoraISO,
          assinadoChefiaPorNome: autorMilitar,
        },
        status: "Em Andamento",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });

      await registrarHistorico(msgHistorico);

      toast.success("DIEx assinado e devolvido ao assessor.");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao assinar DIEx:", error);
      toast.error("Erro ao assinar DIEx");
    }
  };

  const handleAprovarEnviarCHEM = async () => {
    if (!processoId || !user || !isAdmin(user)) return;

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);
      const processoSnap = await getDoc(processoRef);
      const pedidoAtual = processoSnap.exists() ? (processoSnap.data()?.pedidoSubsidios || {}) : {};

      const msgHistorico = "✅ Chefe/Admin aprovou e devolveu para o assessor. O processo segue aguardando a assinatura do CHEM no SPED para posterior registro dos números.";

      await updateDoc(processoRef, {
        pedidoSubsidios: {
          ...pedidoAtual,
          numeroDiex: "",
          numeroDiexHistorico: mergeDiexHistorico(pedidoAtual),
          situacaoFluxo: "aprovado_externo_enviado_chem",
          aprovadoChefiaEm: agoraISO,
          aprovadoChefiaPorNome: autorMilitar,
        },
        status: "Aguardando CHEM",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });

      await registrarHistorico(msgHistorico);

      toast.success("Aprovado e devolvido ao assessor.");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao aprovar/enviar CHEM:", error);
      toast.error("Erro ao aprovar e enviar ao CHEM");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(opening) => {
      if (!opening) resetFormularios();
      onOpenChange(opening);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações DU - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Gerenciar ações de processos da Defesa de Usuários
          </DialogDescription>
        </DialogHeader>

        {!acaoSelecionada && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">Selecione uma ação:</h3>

            {isAdmin(user) && tipoDestinoAtual === "interno" && ["aguardando_assinatura_secao", "enviado_admin"].includes(situacaoFluxoAtual) && (
              <Button
                onClick={() => setAcaoSelecionada("assinar_diex")}
                className="w-full justify-start border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                variant="outline"
              >
                ✍️ Assinar DIEx
              </Button>
            )}

            {isAdmin(user) && tipoDestinoAtual === "externo" && ["aguardando_aprovacao_externa", "enviado_admin"].includes(situacaoFluxoAtual) && (
              <Button
                onClick={() => setAcaoSelecionada("aprovar_enviar_chem")}
                className="w-full justify-start border-blue-300 text-blue-700 hover:bg-blue-50"
                variant="outline"
              >
                ✅ Aprovar e Devolver para o Assessor
              </Button>
            )}
            
            <Button
              onClick={() => setAcaoSelecionada("solicitar_subsidios")}
              className="w-full justify-start border-sky-300 text-sky-700 hover:bg-sky-50"
              variant="outline"
            >
              📨 Solicitar Subsídios
            </Button>

            <Button
              onClick={() => setAcaoSelecionada("registrar_resposta")}
              className="w-full justify-start border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              variant="outline"
            >
              {tipoDestinoAtual === "externo" && ["aprovado_externo_enviado_chem", "aprovado_externo_aguardando_chem"].includes(situacaoFluxoAtual)
                ? "🖊️ Registrar Números Após Assinatura do CHEM"
                : "📤 Registrar Resposta"}
            </Button>
          </div>
        )}

        {acaoSelecionada === "assinar_diex" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-indigo-700">✍️ Assinar DIEx (Chefe de Seção)</h3>

            <div className="space-y-2">
              <Label>Número do DIEx *</Label>
              <Input
                value={numeroDiexResposta}
                onChange={(e) => setNumeroDiexResposta(e.target.value)}
                placeholder="Ex: DIEx Nr 123-AsseApAssJur"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Voltar
              </Button>
              <Button onClick={handleAssinarDiexChefia} className="bg-indigo-600">
                Confirmar Assinatura
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "aprovar_enviar_chem" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-blue-700">✅ Aprovar e Devolver para o Assessor</h3>
            <p className="text-sm text-slate-600">
              O chefe/admin confere a resposta, aprova e devolve o card ao assessor. A partir daí o status fica em aguardando assinatura do CHEM; só depois o assessor informa Ofício e/ou DIEx.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Voltar
              </Button>
              <Button onClick={handleAprovarEnviarCHEM} className="bg-blue-600">
                Aprovar e Devolver
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "solicitar_subsidios" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sky-700">📨 Solicitar Subsídios</h3>

            {!isAdmin(user) && (
              <div className="space-y-2">
                <Label>Tipo de Solicitação</Label>
                <div className="flex items-center gap-4 rounded-md border border-slate-200 p-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="tipo-solicitacao-subsidio"
                      checked={tipoSolicitacaoSubsidio === "primeira_vez"}
                      onChange={() => setTipoSolicitacaoSubsidio("primeira_vez")}
                    />
                    1ª vez
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="tipo-solicitacao-subsidio"
                      checked={tipoSolicitacaoSubsidio === "reiteracao"}
                      onChange={() => setTipoSolicitacaoSubsidio("reiteracao")}
                      disabled={!ultimoPedidoSubsidios?.tipoDestino}
                    />
                    Reiteração
                  </label>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Tipo de Destino</Label>
              <Select
                value={tipoSolicitacaoSubsidio === "reiteracao" ? (ultimoPedidoSubsidios?.tipoDestino || tipoPedidoSubsidio) : tipoPedidoSubsidio}
                onValueChange={(v) => setTipoPedidoSubsidio(v as "interno" | "externo")}
                disabled={tipoSolicitacaoSubsidio === "reiteracao" && !isAdmin(user)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Interno (Seção)</SelectItem>
                  <SelectItem value="externo">Externo (OM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(tipoSolicitacaoSubsidio === "reiteracao" ? (ultimoPedidoSubsidios?.tipoDestino || tipoPedidoSubsidio) : tipoPedidoSubsidio) === "interno" && (
              <div className="space-y-2">
                <Label>Seção Interna *</Label>
                <Select
                  value={tipoSolicitacaoSubsidio === "reiteracao" ? (ultimoPedidoSubsidios?.secaoInterna || secaoInterna) : secaoInterna}
                  onValueChange={setSecaoInterna}
                  disabled={tipoSolicitacaoSubsidio === "reiteracao" && !isAdmin(user)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a seção..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SVP">SVP</SelectItem>
                    <SelectItem value="SFPC">SFPC</SelectItem>
                    <SelectItem value="DIVADM">DIVADM</SelectItem>
                    <SelectItem value="APG">APG</SelectItem>
                    <SelectItem value="PMM">PMM</SelectItem>
                    <SelectItem value="OUTROS">OUTROS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(tipoSolicitacaoSubsidio === "reiteracao" ? (ultimoPedidoSubsidios?.tipoDestino || tipoPedidoSubsidio) : tipoPedidoSubsidio) === "externo" && (
              <div className="space-y-2">
                <Label>OM Externa *</Label>
                <Input 
                  value={tipoSolicitacaoSubsidio === "reiteracao" ? (ultimoPedidoSubsidios?.omExterna || omExterna) : omExterna}
                  onChange={(e) => setOMExterna(e.target.value)}
                  placeholder="Ex: 1º BIS, 2ª Cia..." 
                  disabled={tipoSolicitacaoSubsidio === "reiteracao" && !isAdmin(user)}
                />
              </div>
            )}

            {tipoSolicitacaoSubsidio === "reiteracao" && dieuxAnteriores.length > 0 && (
              <div className="space-y-2">
                <Label>DIEx de pedidos anteriores</Label>
                <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
                  {dieuxAnteriores.join(" | ")}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Número do DIEx {isAdmin(user) ? "" : "(será preenchido depois pelo chefe)"}</Label>
              <Input 
                value={numeroDiex} 
                onChange={(e) => setNumeroDiex(e.target.value)}
                placeholder={isAdmin(user) ? "Ex: DIEx Nr 123-AsseApAssJur" : "Na 1ª vez, o número será preenchido depois"}
                disabled={!isAdmin(user)}
                className={!isAdmin(user) ? "bg-slate-100 cursor-not-allowed" : ""}
              />
            </div>

            <div className="space-y-2">
              <Label>Prazo para Resposta</Label>
              <Input 
                type="date"
                value={prazoResposta} 
                onChange={(e) => setPrazoResposta(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={observacoesSubsidio} 
                onChange={(e) => setObservacoesSubsidio(e.target.value)}
                placeholder="Informações adicionais sobre a solicitação..." 
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Voltar
              </Button>
              <Button onClick={handleSolicitarSubsidios} className="bg-sky-600">
                Enviar Solicitação
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "registrar_resposta" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-emerald-700">
              {tipoDestinoAtual === "externo" && ["aprovado_externo_enviado_chem", "aprovado_externo_aguardando_chem"].includes(situacaoFluxoAtual)
                ? "🖊️ Registrar Números Após Assinatura do CHEM"
                : "📤 Registrar Resposta"}
            </h3>

            {tipoDestinoAtual === "externo" && ["aprovado_externo_enviado_chem", "aprovado_externo_aguardando_chem"].includes(situacaoFluxoAtual) ? (
              <p className="text-sm text-slate-600">
                Após a assinatura no SPED, o assessor registra aqui o número do DIEx, do Ofício ou ambos. Só depois disso o processo poderá ser finalizado.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                O assessor envia a resposta para conferência do Chefe da AssJur. Nesta etapa, os números do documento ainda podem ficar em branco.
              </p>
            )}
            
            <div className="space-y-2">
              <Label>Número do Ofício</Label>
              <Input 
                value={numeroOficio} 
                onChange={(e) => setNumeroOficio(e.target.value)}
                placeholder="Ex: Ofício Nr 45/2026" 
              />
            </div>

            <div className="space-y-2">
              <Label>Número do DIEx</Label>
              <Input 
                value={numeroDiexResposta} 
                onChange={(e) => setNumeroDiexResposta(e.target.value)}
                placeholder="Ex: DIEx Nr 123-AsseApAssJur" 
              />
            </div>

            <div className="space-y-2">
              <Label>Destino do Documento *</Label>
              <Input
                value={destinoDocumentoResposta}
                onChange={(e) => setDestinoDocumentoResposta(e.target.value)}
                placeholder="Ex: CHEM, Assessoria Jurídica, OM solicitante..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Envio</Label>
              <Input 
                type="date"
                value={dataEnvio} 
                onChange={(e) => setDataEnvio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={observacoesResposta} 
                onChange={(e) => setObservacoesResposta(e.target.value)}
                placeholder="Informações complementares sobre a resposta..." 
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Voltar
              </Button>
              <Button onClick={handleRegistrarResposta} className="bg-emerald-600">
                {tipoDestinoAtual === "externo" && ["aprovado_externo_enviado_chem", "aprovado_externo_aguardando_chem"].includes(situacaoFluxoAtual)
                  ? "Salvar Números"
                  : "Enviar para Chefia"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
