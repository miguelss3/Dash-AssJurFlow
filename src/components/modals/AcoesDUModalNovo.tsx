import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { Lock, Send } from "lucide-react";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import {
  AcaoPrincipal,
  AssinaturaDestino,
  LABEL_ACAO,
  LABEL_ASSINATURA_DESTINO,
  LABEL_SITUACAO,
  SituacaoFluxoDU,
  normalizeSituacao,
} from "./AcoesDUModalNovo/shared";
import { FormularioDespacho } from "./AcoesDUModalNovo/FormularioDespacho";
import { MesaChefia } from "./AcoesDUModalNovo/MesaChefia";
import { VigiliaSPED } from "./AcoesDUModalNovo/VigiliaSPED";
import { EntradaResposta } from "./AcoesDUModalNovo/EntradaResposta";

// ---------------------------------------------------------------------------
// V2.1 — AcoesDUModalNovo (orquestrador)
// Responsabilidades: autenticação, carga/persistência do fluxo e roteamento
// para os sub-componentes visuais. Sub-componentes vivem em
// ./AcoesDUModalNovo/* e seguem a identidade "Despacho de Documento".
// ---------------------------------------------------------------------------

interface AcoesDUModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onSuccess?: () => void;
}

export function AcoesDUModalNovo({
  open,
  onOpenChange,
  processoId,
  numeroProcesso,
  onSuccess,
}: AcoesDUModalNovoProps) {
  const { user } = useAuth();
  const ehChefia = isAdmin(user);
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;

  // ---------------- Estado mínimo do V2.1 ----------------
  const [situacaoFluxo, setSituacaoFluxo] = useState<SituacaoFluxoDU>("MESA_ASSESSOR");
  const [acaoPrincipal, setAcaoPrincipal] = useState<AcaoPrincipal>("DILIGENCIA");
  const [assinaturaDestino, setAssinaturaDestino] = useState<AssinaturaDestino>("chefe");
  const [dataPrazo, setDataPrazo] = useState("");
  const [numeroDocumentoDU, setNumeroDocumentoDU] = useState("");
  const [numeroRecebido, setNumeroRecebido] = useState("");
  const [possuiPrazoDU, setPossuiPrazoDU] = useState<boolean>(true);
  const [isReiteracao, setIsReiteracao] = useState<boolean>(false);
  // V2.4 — Composição de documento(s) externos.
  const [incluiDiexExterno, setIncluiDiexExterno] = useState<boolean>(false);
  const [incluiOficioExterno, setIncluiOficioExterno] = useState<boolean>(false);
  const [numeroDiexExterno, setNumeroDiexExterno] = useState<string>("");
  const [numeroOficioExterno, setNumeroOficioExterno] = useState<string>("");
  const [carregandoFluxo, setCarregandoFluxo] = useState(false);
  // V2.8 — Memória do despacho anterior, alimentada na carga inicial.
  // Usada pelo banner de Reiteração no FormularioDespacho.
  const [numeroAnterior, setNumeroAnterior] = useState<string>("");
  const [prazoAnterior, setPrazoAnterior] = useState<string>("");

  // ---------------- Carga ----------------
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
      const dataPrazoCarregada = (pedido?.dataPrazo || pedido?.prazoResposta || "").toString();
      setDataPrazo(dataPrazoCarregada);
      setNumeroRecebido((pedido?.numeroRecebido || "").toString());

      // ---------------------------------------------------------------
      // V2.2 — Fallback robusto para `assinaturaDestino` em cards legados.
      // 1º) tenta o campo novo (top-level ou em pedidoSubsidios).
      // 2º) se vazio, deduz pelo legado tipoDiligencia/tipoDestino:
      //     "EXTERNO"/"CHEM" → "chem"; demais → "chefe".
      // ---------------------------------------------------------------
      const destinoBruto = (data?.assinaturaDestino || pedido?.assinaturaDestino || "")
        .toString()
        .trim()
        .toLowerCase();
      let destinoFinal: AssinaturaDestino;
      if (destinoBruto === "chem" || destinoBruto === "cmt" || destinoBruto === "chefe") {
        destinoFinal = destinoBruto;
      } else {
        const tipoLegado = (
          pedido?.tipoDiligencia
          || pedido?.tipoDestino
          || data?.tipoDiligencia
          || data?.tipoDestino
          || ""
        )
          .toString()
          .trim()
          .toUpperCase();
        destinoFinal = tipoLegado === "EXTERNO" || tipoLegado === "CHEM" ? "chem" : "chefe";
      }
      setAssinaturaDestino(destinoFinal);

      setNumeroDocumentoDU(
        (data?.numeroDocumentoDU || pedido?.numeroDocumentoDU || pedido?.numeroSaida || "").toString(),
      );

      // ---------------------------------------------------------------
      // V2.2 — `possuiPrazoDU` em legados: se não houver flag salva,
      // deduz pela presença de qualquer prazo (dataPrazo/prazoResposta).
      // Isso evita esconder o calendário em cards antigos.
      // ---------------------------------------------------------------
      let possuiPrazoSalvo: boolean;
      if (typeof data?.possuiPrazoDU === "boolean") {
        possuiPrazoSalvo = data.possuiPrazoDU;
      } else if (typeof pedido?.possuiPrazoDU === "boolean") {
        possuiPrazoSalvo = pedido.possuiPrazoDU;
      } else {
        possuiPrazoSalvo = dataPrazoCarregada.trim().length > 0;
      }
      setPossuiPrazoDU(possuiPrazoSalvo);

      // ---------------------------------------------------------------
      // V2.4 — Composição de documentos externos. Lê tanto top-level
      // quanto pedidoSubsidios para garantir compat. com cards antigos.
      // ---------------------------------------------------------------
      const incluiDiex =
        typeof data?.incluiDiexExterno === "boolean"
          ? data.incluiDiexExterno
          : typeof pedido?.incluiDiexExterno === "boolean"
            ? pedido.incluiDiexExterno
            : false;
      const incluiOficio =
        typeof data?.incluiOficioExterno === "boolean"
          ? data.incluiOficioExterno
          : typeof pedido?.incluiOficioExterno === "boolean"
            ? pedido.incluiOficioExterno
            : false;
      setIncluiDiexExterno(incluiDiex);
      setIncluiOficioExterno(incluiOficio);
      setNumeroDiexExterno(
        (data?.numeroDiexExterno || pedido?.numeroDiexExterno || "").toString(),
      );
      setNumeroOficioExterno(
        (data?.numeroOficioExterno || pedido?.numeroOficioExterno || "").toString(),
      );

      // V2.8 — Snapshot do despacho anterior para o banner de Reiteração.
      // Captura o número/prazo "como estavam" ao abrir o modal — o que o
      // assessor digitar agora não polui a memória histórica.
      setNumeroAnterior(
        (
          pedido?.numeroDocumentoDU
          || pedido?.numeroDiex
          || pedido?.numeroSaida
          || data?.numeroDocumentoDU
          || ""
        ).toString(),
      );
      setPrazoAnterior(
        (pedido?.dataPrazo || pedido?.prazoResposta || "").toString(),
      );
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

  // ---------------- Persistência ----------------
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
      reiteracoesIncrement?: number;
      // V2.4 — Composição de documentos externos.
      incluiDiexExterno?: boolean;
      incluiOficioExterno?: boolean;
      numeroDiexExterno?: string;
      numeroOficioExterno?: string;
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
      // V2.4 — Composição de documento(s) externo(s).
      const incluiDiexEfetivo = extras?.incluiDiexExterno ?? incluiDiexExterno;
      const incluiOficioEfetivo = extras?.incluiOficioExterno ?? incluiOficioExterno;
      const numeroDiexExternoEfetivo = (extras?.numeroDiexExterno ?? numeroDiexExterno).trim();
      const numeroOficioExternoEfetivo = (extras?.numeroOficioExterno ?? numeroOficioExterno).trim();
      const agoraISO = new Date().toISOString();

      const descricao =
        extras?.descricaoOverride
        || `Fluxo DU atualizado para ${LABEL_SITUACAO[proximaSituacao]}.`;

      // V2.3 — Histórico imutável de DIEx/Ofícios. Usa Set p/ deduplicar e
      // garante que um novo número nunca apague os anteriores.
      const historicoExistente = Array.isArray(pedidoAtual?.numeroDiexHistorico)
        ? (pedidoAtual.numeroDiexHistorico as string[])
        : [];
      // V2.4 — Acumula no histórico todos os números gerados nesta transição:
      // o genérico (DIEx Simplificado/legado) + DIEx externo + Ofício externo.
      const novosNumeros = [
        numeroDocEfetivo,
        numeroDiexExternoEfetivo,
        numeroOficioExternoEfetivo,
      ].filter((s) => s && s.trim().length > 0);
      const numeroDiexHistorico =
        novosNumeros.length > 0
          ? Array.from(new Set([...historicoExistente, ...novosNumeros]))
          : historicoExistente;

      // V2.3 — Contador de reiterações preservado entre transições.
      const reiteracoesAtual = Number(pedidoAtual?.reiteracoes) || 0;
      const reiteracoesEfetivo = reiteracoesAtual + (extras?.reiteracoesIncrement ?? 0);

      const pedidoSubsidiosPatch = {
        ...pedidoAtual,
        acaoPrincipal: acaoEfetiva,
        assinaturaDestino: destinoEfetivo,
        dataPrazo: prazoEfetivo,
        prazoResposta: prazoEfetivo,
        numeroDocumentoDU: numeroDocEfetivo,
        numeroSaida: numeroDocEfetivo, // espelho legado
        numeroDiex: numeroDocEfetivo || (pedidoAtual?.numeroDiex as string) || "",
        numeroDiexHistorico,
        numeroRecebido: numeroRecebidoEfetivo,
        possuiPrazoDU: possuiPrazoEfetivo,
        // V2.4 — Composição de documentos externos persistida no pedido.
        incluiDiexExterno: incluiDiexEfetivo,
        incluiOficioExterno: incluiOficioEfetivo,
        numeroDiexExterno: numeroDiexExternoEfetivo,
        numeroOficioExterno: numeroOficioExternoEfetivo,
        reiteracoes: reiteracoesEfetivo,
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
        assinaturaDestino: destinoEfetivo,
        numeroDocumentoDU: numeroDocEfetivo,
        possuiPrazoDU: possuiPrazoEfetivo,
        // V2.4 — Espelho top-level dos campos de composição externa.
        incluiDiexExterno: incluiDiexEfetivo,
        incluiOficioExterno: incluiOficioEfetivo,
        numeroDiexExterno: numeroDiexExternoEfetivo,
        numeroOficioExterno: numeroOficioExternoEfetivo,
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
      if (extras?.incluiDiexExterno !== undefined) setIncluiDiexExterno(extras.incluiDiexExterno);
      if (extras?.incluiOficioExterno !== undefined) setIncluiOficioExterno(extras.incluiOficioExterno);
      if (extras?.numeroDiexExterno !== undefined) setNumeroDiexExterno(extras.numeroDiexExterno);
      if (extras?.numeroOficioExterno !== undefined) setNumeroOficioExterno(extras.numeroOficioExterno);

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

  // ---------------- V2.7 — Handler Universal "Despachar / Encaminhar" ----------------
  // Roteia a transição com base em (situacaoFluxo, papel, signatário). Mantém
  // a máquina de estados estabelecida nos handlers anteriores, agora unificada
  // sob um único botão no rodapé.
  const handleDespachoUniversal = () => {
    switch (situacaoFluxo) {
      case "MESA_ASSESSOR": {
        const ehReiteracao = acaoPrincipal === "DILIGENCIA" && isReiteracao;
        void avancarFluxo("CHEFIA_DILIGENCIA", {
          assinaturaDestino,
          acaoPrincipal,
          ...(acaoPrincipal === "DILIGENCIA" && dataPrazo.trim()
            ? { dataPrazo: dataPrazo.trim() }
            : {}),
          ...(ehReiteracao ? { reiteracoesIncrement: 1 } : {}),
          descricaoOverride: ehReiteracao
            ? "Reiteração de Pedido de Subsídios despachada para a Chefia."
            : `Despachado para a Chefia. Ação: ${LABEL_ACAO[acaoPrincipal]}. `
              + `Assinatura: ${LABEL_ASSINATURA_DESTINO[assinaturaDestino]}.`,
        });
        setIsReiteracao(false);
        return;
      }

      case "CHEFIA_DILIGENCIA": {
        if (!ehChefia) return;
        if (assinaturaDestino === "chefe") {
          // Chefe assina diretamente: prazo → AGUARDANDO_RESPOSTA, sem prazo → encerra.
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
        } else {
          // CHEM/Cmt: aprovação manda à Vigília SPED.
          void avancarFluxo("AGUARDANDO_ASSINATURA", {
            assinaturaDestino,
            descricaoOverride:
              `Chefia aprovou via SPED. Aguardando assinatura do `
              + `${LABEL_ASSINATURA_DESTINO[assinaturaDestino]}.`,
          });
        }
        return;
      }

      case "AGUARDANDO_ASSINATURA": {
        // V2.7 — Eliminado o conceito de 2 estágios. Com os números obrigatórios
        // preenchidos, o clique único registra e roteia conforme o prazo.
        const numero = numeroDocumentoDU.trim();
        if (assinaturaDestino === "chefe" && !numero) {
          toast.error("Informe o número do documento gerado.");
          return;
        }
        const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];
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
        return;
      }

      case "AGUARDANDO_RESPOSTA": {
        const numero = numeroRecebido.trim();
        if (!numero) {
          toast.error("Informe o número do documento recebido.");
          return;
        }
        void avancarFluxo("MESA_ASSESSOR", {
          numeroRecebido: numero,
          descricaoOverride: "Resposta recebida. Em análise pelo assessor.",
        });
        return;
      }
    }
  };

  // V2.7 — Marcha à Ré: minuta rejeitada na assinatura externa (Vigília SPED).
  const handleMinutaRejeitada = () => {
    void avancarFluxo("MESA_ASSESSOR", {
      possuiPrazoDU: false,
      descricaoOverride: "Minuta rejeitada no SPED. Devolvida ao assessor para correções.",
    });
  };

  // V2.7 — Devolver ao Assessor (Chefia desiste sem ação).
  const handleDevolverAssessor = () => {
    void avancarFluxo("MESA_ASSESSOR", {
      descricaoOverride: "Chefia devolveu o processo ao assessor sem ação.",
    });
  };

  // V2.7 — Validação de bloqueio do botão universal por fase.
  const despachoBloqueado = useMemo(() => {
    switch (situacaoFluxo) {
      case "MESA_ASSESSOR":
        // Para DILIGENCIA exigimos prazo; DEFESA é livre.
        return acaoPrincipal === "DILIGENCIA" && !dataPrazo.trim();
      case "CHEFIA_DILIGENCIA":
        if (!ehChefia) return true;
        if (assinaturaDestino === "chefe") {
          if (!numeroDocumentoDU.trim()) return true;
          if (possuiPrazoDU && !dataPrazo.trim()) return true;
          return false;
        }
        // chem/cmt → aprovação para SPED não exige campos.
        return false;
      case "AGUARDANDO_ASSINATURA": {
        // Campos obrigatórios das colunas fixas (input de número da Vigília).
        const externoOk =
          assinaturaDestino === "chefe"
            ? numeroDocumentoDU.trim().length > 0
            : (incluiDiexExterno && numeroDiexExterno.trim().length > 0)
              || (incluiOficioExterno && numeroOficioExterno.trim().length > 0);
        if (!externoOk) return true;
        if (possuiPrazoDU && !dataPrazo.trim()) return true;
        return false;
      }
      case "AGUARDANDO_RESPOSTA":
        return numeroRecebido.trim().length === 0;
      default:
        return true;
    }
  }, [
    situacaoFluxo,
    acaoPrincipal,
    assinaturaDestino,
    dataPrazo,
    possuiPrazoDU,
    numeroDocumentoDU,
    numeroRecebido,
    incluiDiexExterno,
    incluiOficioExterno,
    numeroDiexExterno,
    numeroOficioExterno,
    ehChefia,
  ]);

  // ---------------- Roteamento de visões ----------------
  const renderVisaoAssessor = () => {
    if (situacaoFluxo === "CHEFIA_DILIGENCIA") {
      return (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center animate-in fade-in">
          <Lock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <h4 className="font-bold text-slate-900 text-sm">Aguardando ação da Chefia</h4>
          <p className="text-[11px] text-slate-600 mt-1">
            O processo já foi despachado. Acompanhe o andamento pelo Kanban.
          </p>
        </div>
      );
    }
    if (situacaoFluxo === "AGUARDANDO_ASSINATURA") {
      return (
        <VigiliaSPED
          assinaturaDestino={assinaturaDestino}
          numeroDocumentoDU={numeroDocumentoDU}
          setNumeroDocumentoDU={setNumeroDocumentoDU}
          possuiPrazoDU={possuiPrazoDU}
          setPossuiPrazoDU={setPossuiPrazoDU}
          dataPrazo={dataPrazo}
          setDataPrazo={setDataPrazo}
          incluiDiexExterno={incluiDiexExterno}
          setIncluiDiexExterno={setIncluiDiexExterno}
          incluiOficioExterno={incluiOficioExterno}
          setIncluiOficioExterno={setIncluiOficioExterno}
          numeroDiexExterno={numeroDiexExterno}
          setNumeroDiexExterno={setNumeroDiexExterno}
          numeroOficioExterno={numeroOficioExterno}
          setNumeroOficioExterno={setNumeroOficioExterno}
        />
      );
    }
    if (situacaoFluxo === "AGUARDANDO_RESPOSTA") {
      return (
        <EntradaResposta
          numeroRecebido={numeroRecebido}
          setNumeroRecebido={setNumeroRecebido}
        />
      );
    }
    return (
      <FormularioDespacho
        acaoPrincipal={acaoPrincipal}
        setAcaoPrincipal={setAcaoPrincipal}
        assinaturaDestino={assinaturaDestino}
        setAssinaturaDestino={setAssinaturaDestino}
        dataPrazo={dataPrazo}
        setDataPrazo={setDataPrazo}
        isReiteracao={isReiteracao}
        setIsReiteracao={setIsReiteracao}
        numeroDocumentoDU={numeroDocumentoDU}
        setNumeroDocumentoDU={setNumeroDocumentoDU}
        incluiDiexExterno={incluiDiexExterno}
        setIncluiDiexExterno={setIncluiDiexExterno}
        incluiOficioExterno={incluiOficioExterno}
        setIncluiOficioExterno={setIncluiOficioExterno}
        numeroDiexExterno={numeroDiexExterno}
        setNumeroDiexExterno={setNumeroDiexExterno}
        numeroOficioExterno={numeroOficioExterno}
        setNumeroOficioExterno={setNumeroOficioExterno}
        numeroAnterior={numeroAnterior}
        prazoAnterior={prazoAnterior}
      />
    );
  };

  const renderVisaoChefe = () => {
    switch (situacaoFluxo) {
      case "CHEFIA_DILIGENCIA":
        return (
          <MesaChefia
            assinaturaDestino={assinaturaDestino}
            acaoPrincipal={acaoPrincipal}
            numeroDocumentoDU={numeroDocumentoDU}
            setNumeroDocumentoDU={setNumeroDocumentoDU}
            possuiPrazoDU={possuiPrazoDU}
            setPossuiPrazoDU={setPossuiPrazoDU}
            dataPrazo={dataPrazo}
            setDataPrazo={setDataPrazo}
            incluiDiexExterno={incluiDiexExterno}
            setIncluiDiexExterno={setIncluiDiexExterno}
            incluiOficioExterno={incluiOficioExterno}
            setIncluiOficioExterno={setIncluiOficioExterno}
            numeroDiexExterno={numeroDiexExterno}
            setNumeroDiexExterno={setNumeroDiexExterno}
            numeroOficioExterno={numeroOficioExterno}
            setNumeroOficioExterno={setNumeroOficioExterno}
          />
        );
      case "AGUARDANDO_ASSINATURA":
      case "AGUARDANDO_RESPOSTA":
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

        {/* V2.7 — Rodapé universal "Despachar / Encaminhar". Espelha o SPED:
            uma única ação primária por fase, com secundários condicionais. */}
        {!carregandoFluxo && (
          <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col gap-2">
            {/* 1. Ação principal — único botão primário por fase. */}
            <button
              onClick={handleDespachoUniversal}
              disabled={despachoBloqueado}
              className="w-full py-3 rounded-xl text-sm font-bold border border-transparent bg-[#0F172A] hover:bg-slate-800 text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Despachar / Encaminhar
            </button>

            {/* 2. Retorno / Devolução — contorno âmbar. Padronizado para
                 "Devolver ao Assessor" tanto na Chefia quanto no SPED. */}
            {ehChefia && situacaoFluxo === "CHEFIA_DILIGENCIA" && (
              <button
                onClick={handleDevolverAssessor}
                className="w-full py-3 rounded-xl text-sm font-bold bg-white border border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                Devolver ao Assessor
              </button>
            )}

            {situacaoFluxo === "AGUARDANDO_ASSINATURA" && (
              <button
                onClick={handleMinutaRejeitada}
                className="w-full py-3 rounded-xl text-sm font-bold bg-white border border-amber-400 text-amber-700 hover:bg-amber-50"
              >
                Devolver ao Assessor
              </button>
            )}

            {/* 3. Encerramento — contorno vermelho, sempre disponível. */}
            <button
              onClick={() => void finalizarProcesso()}
              className="w-full py-3 rounded-xl text-sm font-bold bg-white border border-red-300 text-red-700 hover:bg-red-50"
            >
              Finalizar Processo
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
