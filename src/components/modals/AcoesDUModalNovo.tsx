import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { ArrowRightCircle, CalendarIcon, FileSignature, Lock, Send } from "lucide-react";

// ---------------------------------------------------------------------------
// V2.1 — Tramitação Livre Vigiada
// Fluxo enxuto, com hierarquia visual de DOCUMENTO:
//   Signatário (cabeçalho) → Objeto → Prazo → Botão (rodapé).
// ---------------------------------------------------------------------------

type SituacaoFluxoDU =
  | "MESA_ASSESSOR"
  | "CHEFIA_DILIGENCIA"
  | "AGUARDANDO_ASSINATURA"
  | "AGUARDANDO_RESPOSTA";

type AcaoPrincipal = "DILIGENCIA" | "DEFESA";

// chefe = Chefe da AssJur assina diretamente (DIEx Simplificado).
// chem  = CHEM aprova via SPED.
// cmt   = Comandante aprova via SPED.
type AssinaturaDestino = "chefe" | "chem" | "cmt";

const LABEL_ASSINATURA_DESTINO: Record<AssinaturaDestino, string> = {
  chefe: "Chefe da AssJur",
  chem: "CHEM",
  cmt: "Comandante",
};

const LABEL_ACAO: Record<AcaoPrincipal, string> = {
  DILIGENCIA: "Pedido de Subsídios",
  DEFESA: "Resposta Definitiva",
};

const LABEL_SITUACAO: Record<SituacaoFluxoDU, string> = {
  MESA_ASSESSOR: "Mesa do Assessor",
  CHEFIA_DILIGENCIA: "Na Chefia",
  AGUARDANDO_ASSINATURA: "Aguardando Assinatura no SPED",
  AGUARDANDO_RESPOSTA: "Aguardando Resposta",
};

interface AcoesDUModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onSuccess?: () => void;
}

// Mapeia QUALQUER estado legado para um dos 4 estados ativos do V2.1.
const normalizeSituacao = (situacao?: string): SituacaoFluxoDU => {
  switch (situacao) {
    case "MESA_ASSESSOR":
    case "CHEFIA_DILIGENCIA":
    case "AGUARDANDO_ASSINATURA":
    case "AGUARDANDO_RESPOSTA":
      return situacao;
    case "CHEFIA_DEFESA":
    case "aguardando_assinatura_secao":
    case "aguardando_aprovacao_externa":
    case "enviado_admin":
      return "CHEFIA_DILIGENCIA";
    case "AGUARDANDO_CHEM_DILIGENCIA":
    case "AGUARDANDO_CHEM_DEFESA":
    case "aprovado_externo_enviado_chem":
    case "aprovado_externo_aguardando_chem":
      return "AGUARDANDO_ASSINATURA";
    default:
      return "MESA_ASSESSOR";
  }
};

export function AcoesDUModalNovo({ open, onOpenChange, processoId, numeroProcesso, onSuccess }: AcoesDUModalNovoProps) {
  const { user } = useAuth();
  const ehChefia = isAdmin(user);
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;

  // Estado mínimo do V2.1
  const [situacaoFluxo, setSituacaoFluxo] = useState<SituacaoFluxoDU>("MESA_ASSESSOR");
  const [acaoPrincipal, setAcaoPrincipal] = useState<AcaoPrincipal>("DILIGENCIA");
  const [assinaturaDestino, setAssinaturaDestino] = useState<AssinaturaDestino>("chefe");
  const [dataPrazo, setDataPrazo] = useState("");
  const [numeroDocumentoDU, setNumeroDocumentoDU] = useState("");
  const [numeroRecebido, setNumeroRecebido] = useState("");
  const [possuiPrazoDU, setPossuiPrazoDU] = useState<boolean>(true);
  const [carregandoFluxo, setCarregandoFluxo] = useState(false);

  const carregarFluxo = async () => {
    if (!processoId) return;
    setCarregandoFluxo(true);
    try {
      const snap = await getDoc(doc(db, "processos", processoId));
      if (!snap.exists()) return;
      const data = snap.data();
      const pedido = data?.pedidoSubsidios || {};

      setSituacaoFluxo(normalizeSituacao(pedido?.situacaoFluxo));
      setAcaoPrincipal((pedido?.acaoPrincipal as AcaoPrincipal) || "DILIGENCIA");
      setDataPrazo((pedido?.dataPrazo || pedido?.prazoResposta || "").toString());
      setNumeroRecebido((pedido?.numeroRecebido || "").toString());

      const destinoSalvo = (data?.assinaturaDestino || pedido?.assinaturaDestino || "chefe").toString();
      setAssinaturaDestino(
        destinoSalvo === "chem" || destinoSalvo === "cmt" || destinoSalvo === "chefe"
          ? destinoSalvo
          : "chefe",
      );
      setNumeroDocumentoDU(
        (data?.numeroDocumentoDU || pedido?.numeroDocumentoDU || pedido?.numeroSaida || "").toString(),
      );
      const possuiPrazoSalvo =
        typeof data?.possuiPrazoDU === "boolean"
          ? data.possuiPrazoDU
          : typeof pedido?.possuiPrazoDU === "boolean"
            ? pedido.possuiPrazoDU
            : true;
      setPossuiPrazoDU(possuiPrazoSalvo);
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

  // -------------------------------------------------------------------------
  // PERSISTÊNCIA — registra o histórico em duas coleções (subcoleção do
  // processo + documento agregado em /mensagens) para retro-compatibilidade.
  // -------------------------------------------------------------------------
  const registrarHistorico = async (texto: string) => {
    const agoraISO = new Date().toISOString();
    await addDoc(collection(db, `processos/${processoId}/historico`), {
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
        { id: crypto.randomUUID(), autor: autorMilitar, autorId: user?.uid || "sistema", texto, timestamp: agoraISO },
      ],
    });
  };

  // -------------------------------------------------------------------------
  // AVANÇAR FLUXO — patch único + snapshot para undo. O campo numeroSaida é
  // mantido como espelho de numeroDocumentoDU para queries legadas (Kanban,
  // mesa, indicadores) sem quebrar nada.
  // -------------------------------------------------------------------------
  const avancarFluxo = async (
    proximaSituacao: SituacaoFluxoDU,
    extras?: {
      acaoPrincipal?: AcaoPrincipal;
      assinaturaDestino?: AssinaturaDestino;
      dataPrazo?: string;
      numeroDocumentoDU?: string;
      numeroRecebido?: string;
      possuiPrazoDU?: boolean;
      descricaoOverride?: string;
    },
  ) => {
    if (!processoId || !user) return;
    try {
      const processoRef = doc(db, "processos", processoId);
      const snap = await getDoc(processoRef);
      const dataAtual = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      const pedidoAtual = (dataAtual?.pedidoSubsidios as Record<string, unknown>) || {};

      const acaoEfetiva = extras?.acaoPrincipal ?? acaoPrincipal;
      const destinoEfetivo = extras?.assinaturaDestino ?? assinaturaDestino;
      const prazoEfetivo = (extras?.dataPrazo ?? dataPrazo).trim();
      const numeroDocEfetivo = (extras?.numeroDocumentoDU ?? numeroDocumentoDU).trim();
      const numeroRecebidoEfetivo = (extras?.numeroRecebido ?? numeroRecebido).trim();
      const possuiPrazoEfetivo = extras?.possuiPrazoDU ?? possuiPrazoDU;
      const agoraISO = new Date().toISOString();

      const descricao =
        extras?.descricaoOverride
        || `Fluxo DU atualizado para ${LABEL_SITUACAO[proximaSituacao]}.`;

      const pedidoSubsidiosPatch = {
        ...pedidoAtual,
        acaoPrincipal: acaoEfetiva,
        assinaturaDestino: destinoEfetivo,
        dataPrazo: prazoEfetivo,
        prazoResposta: prazoEfetivo,
        numeroDocumentoDU: numeroDocEfetivo,
        numeroSaida: numeroDocEfetivo, // espelho legado
        numeroDiex: numeroDocEfetivo || (pedidoAtual?.numeroDiex as string) || "",
        numeroRecebido: numeroRecebidoEfetivo,
        possuiPrazoDU: possuiPrazoEfetivo,
        situacaoFluxo: proximaSituacao,
        solicitadoEm:
          proximaSituacao === "AGUARDANDO_RESPOSTA"
            ? agoraISO
            : (pedidoAtual?.solicitadoEm as string) || "",
        solicitadoPorNome:
          proximaSituacao === "AGUARDANDO_RESPOSTA"
            ? autorMilitar
            : (pedidoAtual?.solicitadoPorNome as string) || "",
      };

      const previousDoc = { ...dataAtual };
      delete (previousDoc as Record<string, unknown>).ultimaAcaoFluxo;

      await updateDoc(processoRef, {
        pedidoSubsidios: pedidoSubsidiosPatch,
        // Espelho top-level dos campos do V2.1
        assinaturaDestino: destinoEfetivo,
        numeroDocumentoDU: numeroDocEfetivo,
        possuiPrazoDU: possuiPrazoEfetivo,
        status: LABEL_SITUACAO[proximaSituacao],
        descricao,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        ultimaAcaoFluxo: {
          tipo: "DU",
          criadoEm: agoraISO,
          criadoPorNome: autorMilitar,
          previousDoc,
        },
      });
      await registrarHistorico(descricao);

      setSituacaoFluxo(proximaSituacao);
      if (extras?.acaoPrincipal !== undefined) setAcaoPrincipal(extras.acaoPrincipal);
      if (extras?.assinaturaDestino !== undefined) setAssinaturaDestino(extras.assinaturaDestino);
      if (extras?.dataPrazo !== undefined) setDataPrazo(extras.dataPrazo);
      if (extras?.numeroDocumentoDU !== undefined) setNumeroDocumentoDU(extras.numeroDocumentoDU);
      if (extras?.numeroRecebido !== undefined) setNumeroRecebido(extras.numeroRecebido);
      if (extras?.possuiPrazoDU !== undefined) setPossuiPrazoDU(extras.possuiPrazoDU);

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
      const snap = await getDoc(processoRef);
      const dataAtual = (snap.exists() ? snap.data() : {}) as Record<string, unknown>;
      const previousDoc = { ...dataAtual };
      delete (previousDoc as Record<string, unknown>).ultimaAcaoFluxo;
      const descricao = "Processo finalizado no fluxo DU.";

      await updateDoc(processoRef, {
        status: "concluido",
        descricao,
        finalizado: true,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
        ultimaAcaoFluxo: {
          tipo: "DU",
          criadoEm: new Date().toISOString(),
          criadoPorNome: autorMilitar,
          previousDoc,
        },
      });
      await registrarHistorico(descricao);
      toast.success("Processo finalizado com sucesso.");
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao finalizar processo:", error);
      toast.error("Não foi possível finalizar o processo.");
    }
  };

  const cabecalhoSituacao = useMemo(() => LABEL_SITUACAO[situacaoFluxo], [situacaoFluxo]);

  // =========================================================================
  // SUB-COMPONENTES DE UI (DRY) — usados nas visões do Assessor e da Chefia.
  // =========================================================================

  // Cabeçalho do despacho — define QUEM assina. Estética de documento oficial.
  const SecaoSignatario = (
    <header className="border-b-2 border-slate-300 pb-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
        Despacho dirigido a
      </p>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(["chefe", "chem", "cmt"] as AssinaturaDestino[]).map((opt) => (
          <label
            key={opt}
            className={`flex items-center justify-center gap-2 p-2.5 border rounded-md text-xs font-bold cursor-pointer transition-colors ${
              assinaturaDestino === opt
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
            }`}
          >
            <input
              type="radio"
              name="assinatura-destino-du"
              aria-label={LABEL_ASSINATURA_DESTINO[opt]}
              checked={assinaturaDestino === opt}
              onChange={() => setAssinaturaDestino(opt)}
              className="hidden"
            />
            {LABEL_ASSINATURA_DESTINO[opt]}
          </label>
        ))}
      </div>
    </header>
  );

  // Corpo do despacho — define O QUE será feito.
  const SecaoObjeto = (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
        Objeto do despacho
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(Object.keys(LABEL_ACAO) as AcaoPrincipal[]).map((opt) => (
          <label
            key={opt}
            className={`flex items-center justify-center p-3 border rounded-md text-sm font-semibold cursor-pointer transition-colors ${
              acaoPrincipal === opt
                ? "bg-sky-50 border-sky-400 text-sky-900"
                : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="acao-principal-du"
              aria-label={LABEL_ACAO[opt]}
              checked={acaoPrincipal === opt}
              onChange={() => {
                setAcaoPrincipal(opt);
                if (opt === "DEFESA") setDataPrazo("");
              }}
              className="hidden"
            />
            {LABEL_ACAO[opt]}
          </label>
        ))}
      </div>
    </section>
  );

  // Prazo — só faz sentido para Pedido de Subsídios.
  const SecaoPrazo = acaoPrincipal === "DILIGENCIA" && (
    <section>
      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2 flex items-center gap-1">
        <CalendarIcon className="w-3 h-3" /> Prazo para resposta
      </label>
      <input
        type="date"
        aria-label="Prazo para resposta"
        value={dataPrazo}
        onChange={(e) => setDataPrazo(e.target.value)}
        className="w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm"
      />
    </section>
  );

  const BotaoFinalizarRodape = (
    <button
      onClick={finalizarProcesso}
      className="w-full border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold py-2 rounded-md transition-colors"
    >
      Finalizar Processo
    </button>
  );

  // =========================================================================
  // FORMULÁRIO UNIVERSAL DE DESPACHO (Assessor → Chefia)
  // Hierarquia visual de DOCUMENTO: Signatário → Objeto → Prazo → Botão.
  // =========================================================================
  const FormularioDespacho = (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
      <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-sm">
        {SecaoSignatario}
        {SecaoObjeto}
        {SecaoPrazo}
      </article>

      <button
        onClick={() => {
          void avancarFluxo("CHEFIA_DILIGENCIA", {
            assinaturaDestino,
            acaoPrincipal,
            ...(acaoPrincipal === "DILIGENCIA" && dataPrazo.trim()
              ? { dataPrazo: dataPrazo.trim() }
              : {}),
            descricaoOverride:
              `Despachado para a Chefia. Ação: ${LABEL_ACAO[acaoPrincipal]}. `
              + `Assinatura: ${LABEL_ASSINATURA_DESTINO[assinaturaDestino]}.`,
          });
        }}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-md flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" /> Enviar para Chefia
      </button>

      {BotaoFinalizarRodape}
    </div>
  );

  // =========================================================================
  // VIGÍLIA DO SPED — após CHEM/Cmt aprovar, registra-se o nº do documento.
  // =========================================================================
  const RenderVigiliaSPED = () => {
    const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];
    const podeRegistrar =
      numeroDocumentoDU.trim().length > 0 && (!possuiPrazoDU || dataPrazo.trim().length > 0);

    const registrarDocumentoSPED = () => {
      const numero = numeroDocumentoDU.trim();
      if (!numero) {
        toast.error("Informe o número do documento gerado.");
        return;
      }
      // ROTEAMENTO: COM prazo → AGUARDANDO_RESPOSTA; SEM prazo → MESA_ASSESSOR.
      if (possuiPrazoDU) {
        if (!dataPrazo.trim()) {
          toast.error("Defina o prazo para resposta.");
          return;
        }
        void avancarFluxo("AGUARDANDO_RESPOSTA", {
          numeroDocumentoDU: numero,
          possuiPrazoDU: true,
          dataPrazo: dataPrazo.trim(),
          assinaturaDestino,
          descricaoOverride: `Documento ${numero} assinado por ${rotuloAutoridade}. Prazo iniciado.`,
        });
      } else {
        void avancarFluxo("MESA_ASSESSOR", {
          numeroDocumentoDU: numero,
          possuiPrazoDU: false,
          assinaturaDestino,
          descricaoOverride: `Documento ${numero} assinado por ${rotuloAutoridade}. Sem prazo.`,
        });
      }
    };

    return (
      <div className="space-y-4 animate-in fade-in">
        <article className="bg-white border border-violet-200 rounded-xl p-5 space-y-4">
          <header className="border-b border-violet-200 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">
              Vigília do SPED
            </p>
            <p className="text-xs text-violet-800 mt-1">
              Aguardando assinatura do <strong>{rotuloAutoridade}</strong> no SPED.
            </p>
          </header>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">
              Número do documento gerado
            </label>
            <input
              type="text"
              aria-label="Número do documento gerado no SPED"
              value={numeroDocumentoDU}
              onChange={(e) => setNumeroDocumentoDU(e.target.value)}
              placeholder="Ex: Ofício nº 123/2026"
              className="w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
              Existe prazo para resposta?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[true, false].map((v) => (
                <label
                  key={String(v)}
                  className={`flex items-center justify-center p-2 border rounded-md text-xs font-bold cursor-pointer ${
                    possuiPrazoDU === v
                      ? "bg-violet-100 border-violet-300 text-violet-900"
                      : "bg-white border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="possui-prazo-du"
                    aria-label={v ? "Sim" : "Não"}
                    checked={possuiPrazoDU === v}
                    onChange={() => setPossuiPrazoDU(v)}
                    className="hidden"
                  />
                  {v ? "Sim" : "Não"}
                </label>
              ))}
            </div>
          </div>

          {possuiPrazoDU && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" /> Prazo para resposta
              </label>
              <input
                type="date"
                aria-label="Prazo para resposta"
                value={dataPrazo}
                onChange={(e) => setDataPrazo(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm"
              />
            </div>
          )}
        </article>

        <button
          disabled={!podeRegistrar}
          onClick={registrarDocumentoSPED}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-bold py-3 rounded-md"
        >
          Registrar Documento
        </button>
        {BotaoFinalizarRodape}
      </div>
    );
  };

  // =========================================================================
  // ENTRADA DE RESPOSTA — UI minimalista (V2.1 Tarefa 3).
  // Único input + único botão. Sem decoração.
  // =========================================================================
  const RenderEntradaResposta = () => {
    const registrarChegada = () => {
      const numero = numeroRecebido.trim();
      if (!numero) {
        toast.error("Informe o número do documento recebido.");
        return;
      }
      void avancarFluxo("MESA_ASSESSOR", {
        numeroRecebido: numero,
        descricaoOverride: "Resposta recebida. Em análise pelo assessor.",
      });
    };

    return (
      <div className="space-y-3 animate-in fade-in">
        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 block">
          Número do documento recebido
        </label>
        <input
          type="text"
          aria-label="Número do documento recebido"
          value={numeroRecebido}
          onChange={(e) => setNumeroRecebido(e.target.value)}
          placeholder="Ex: Ofício 321/2026"
          className="w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm"
        />
        <button
          disabled={!numeroRecebido.trim()}
          onClick={registrarChegada}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white font-bold py-3 rounded-md text-sm flex items-center justify-center gap-2"
        >
          <ArrowRightCircle className="w-4 h-4" /> Registrar Entrada e Devolver ao Assessor
        </button>
        {BotaoFinalizarRodape}
      </div>
    );
  };

  // =========================================================================
  // MESA DA CHEFIA (CHEFIA_DILIGENCIA) — bifurca por papel da autoridade.
  // =========================================================================
  const RenderMesaChefia = () => {
    const ehAssinaturaChefe = assinaturaDestino === "chefe";
    const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];

    const assinarEFinalizar = () => {
      const numero = numeroDocumentoDU.trim();
      if (!numero) {
        toast.error("Informe o número do DIEx Simplificado.");
        return;
      }
      if (possuiPrazoDU) {
        if (!dataPrazo.trim()) {
          toast.error("Defina o prazo para resposta antes de assinar.");
          return;
        }
        void avancarFluxo("AGUARDANDO_RESPOSTA", {
          numeroDocumentoDU: numero,
          possuiPrazoDU: true,
          dataPrazo: dataPrazo.trim(),
          assinaturaDestino: "chefe",
          acaoPrincipal: "DILIGENCIA",
          descricaoOverride: `DIEx ${numero} assinado pelo Chefe da AssJur. Prazo iniciado.`,
        });
      } else {
        void finalizarProcesso();
      }
    };

    const aprovarViaSPED = () => {
      void avancarFluxo("AGUARDANDO_ASSINATURA", {
        assinaturaDestino,
        descricaoOverride: `Chefia aprovou via SPED. Aguardando assinatura do ${rotuloAutoridade}.`,
      });
    };

    const devolverParaAssessor = () => {
      void avancarFluxo("MESA_ASSESSOR", {
        descricaoOverride: "Chefia devolveu o processo ao assessor sem ação.",
      });
    };

    return (
      <div className="space-y-4 animate-in fade-in">
        <article className="bg-white border border-indigo-200 rounded-xl p-5 space-y-4">
          <header className="border-b border-indigo-200 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Despacho dirigido a
            </p>
            <p className="text-base font-bold text-indigo-900 mt-1">{rotuloAutoridade}</p>
            <p className="text-[11px] text-indigo-700 mt-0.5">
              Objeto: {LABEL_ACAO[acaoPrincipal]}
            </p>
          </header>

          {ehAssinaturaChefe ? (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 block">
                  Nr DIEx Simplificado
                </label>
                <input
                  type="text"
                  aria-label="Número do DIEx Simplificado"
                  value={numeroDocumentoDU}
                  onChange={(e) => setNumeroDocumentoDU(e.target.value)}
                  placeholder="Ex: DIEx 045/2026"
                  className="w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Existe prazo para resposta?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <label
                      key={String(v)}
                      className={`flex items-center justify-center p-2 border rounded-md text-xs font-bold cursor-pointer ${
                        possuiPrazoDU === v
                          ? "bg-indigo-100 border-indigo-300 text-indigo-900"
                          : "bg-white border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="possui-prazo-chefia"
                        aria-label={v ? "Sim" : "Não"}
                        checked={possuiPrazoDU === v}
                        onChange={() => setPossuiPrazoDU(v)}
                        className="hidden"
                      />
                      {v ? "Sim" : "Não"}
                    </label>
                  ))}
                </div>
              </div>

              {possuiPrazoDU && (
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1 flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" /> Prazo para resposta
                  </label>
                  <input
                    type="date"
                    aria-label="Prazo para resposta do DIEx"
                    value={dataPrazo}
                    onChange={(e) => setDataPrazo(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-md outline-none text-sm"
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-[12px] text-indigo-800 bg-indigo-50 p-3 rounded">
              Encaminhe via SPED para assinatura do <strong>{rotuloAutoridade}</strong>. O número do
              documento será informado posteriormente, na vigília do SPED.
            </p>
          )}
        </article>

        {ehAssinaturaChefe ? (
          <button
            onClick={assinarEFinalizar}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md text-sm flex items-center justify-center gap-2"
          >
            <FileSignature className="w-4 h-4" />
            Assinar e {possuiPrazoDU ? "Iniciar Prazo" : "Finalizar"}
          </button>
        ) : (
          <button
            onClick={aprovarViaSPED}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-md text-sm"
          >
            Aprovar via SPED
          </button>
        )}

        <button
          onClick={devolverParaAssessor}
          className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          Devolver ao Assessor
        </button>

        {BotaoFinalizarRodape}
      </div>
    );
  };

  // =========================================================================
  // VISÃO ASSESSOR — fallback engole legados via normalizeSituacao.
  // =========================================================================
  const renderVisaoAssessor = () => {
    if (situacaoFluxo === "CHEFIA_DILIGENCIA") {
      return (
        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 text-center animate-in fade-in">
          <Lock className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
          <h4 className="font-bold text-indigo-900 text-sm">Aguardando ação da Chefia</h4>
          <p className="text-[11px] text-indigo-700 mt-1">
            O processo já foi despachado. Acompanhe o andamento pelo Kanban.
          </p>
        </div>
      );
    }
    if (situacaoFluxo === "AGUARDANDO_ASSINATURA") return <RenderVigiliaSPED />;
    if (situacaoFluxo === "AGUARDANDO_RESPOSTA") return <RenderEntradaResposta />;
    return FormularioDespacho;
  };

  // =========================================================================
  // VISÃO CHEFIA — switch enxuto, fallback no formulário do assessor.
  // =========================================================================
  const renderVisaoChefe = () => {
    switch (situacaoFluxo) {
      case "CHEFIA_DILIGENCIA":
        return <RenderMesaChefia />;
      case "AGUARDANDO_ASSINATURA":
        return <RenderVigiliaSPED />;
      case "AGUARDANDO_RESPOSTA":
        return <RenderEntradaResposta />;
      default:
        return renderVisaoAssessor();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações DU - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Fluxo inteligente de tramitação da Defesa da União.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <strong>Situação atual:</strong> {cabecalhoSituacao}
        </div>

        {carregandoFluxo ? (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center text-sm text-slate-600">
            Carregando ações do processo...
          </div>
        ) : ehChefia ? (
          renderVisaoChefe()
        ) : (
          renderVisaoAssessor()
        )}
      </DialogContent>
    </Dialog>
  );
}
