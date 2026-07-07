import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  LABEL_SITUACAO_IP,
  type DocumentoIP,
  type SituacaoFluxoIP,
} from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";

// ---------------------------------------------------------------------------
// V5.1 — AcoesIPModalV4
// "Workspace" da Investigação Preliminar. Sem fases engessadas:
//  • Bloco 1: Registro de documentos (Expedidos / Recebidos)
//  • Bloco 2: Diário da investigação (notas livres -> /historico)
//  • Bloco 3: Ping-pong Assessor <-> Chefia + Finalizar
// Visual idêntico aos modais V4 (slate-50 / slate-900, sem verde).
// ---------------------------------------------------------------------------

interface AcoesIPModalV4Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  siteSettings?: SiteSettings; // mantido por compat com a assinatura PA
  onSuccess?: () => void;
}

interface NotaHistorico {
  id: string;
  autor?: string;
  texto?: string;
  timestamp?: string;
}

// Alguns registros legados gravam `timestamp` como Firestore Timestamp em vez
// de string ISO — normaliza para string antes de qualquer .slice()/formatação.
const normalizarTimestamp = (valor: unknown): string => {
  if (typeof valor === "string") return valor;
  if (valor instanceof Timestamp) return valor.toDate().toISOString();
  if (valor && typeof (valor as { toDate?: () => Date }).toDate === "function") {
    return (valor as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
};

export function AcoesIPModalV4({
  open,
  onOpenChange,
  processoId,
  numeroProcesso,
  onSuccess,
}: AcoesIPModalV4Props) {
  const { user } = useAuth();
  const nomeAutorBase =
    user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto
    ? `${user.posto} ${nomeAutorBase}`.trim()
    : nomeAutorBase;

  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [parte, setParte] = useState<string>("");
  const [tipoPA, setTipoPA] = useState<string>("Investigação Preliminar");
  const [situacaoAtual, setSituacaoAtual] =
    useState<SituacaoFluxoIP>("MESA_ASSESSOR");
  const [documentos, setDocumentos] = useState<DocumentoIP[]>([]);

  // Inline-form de novo documento.
  const [showFormDoc, setShowFormDoc] = useState<boolean>(false);
  const [novoTipoDoc, setNovoTipoDoc] = useState<"Expedido" | "Recebido">(
    "Expedido",
  );
  const [novaDescricaoDoc, setNovaDescricaoDoc] = useState<string>("");
  const [novaDataDoc, setNovaDataDoc] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  // Diário (notas livres).
  const [novaNota, setNovaNota] = useState<string>("");
  const [salvandoNota, setSalvandoNota] = useState<boolean>(false);
  const [ultimasNotas, setUltimasNotas] = useState<NotaHistorico[]>([]);

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
        const sit =
          (data?.situacaoFluxoIP as SituacaoFluxoIP | undefined)
          || (data?.finalizado ? "FINALIZADO" : "MESA_ASSESSOR");
        setSituacaoAtual(sit);
        setParte(((data?.cliente as string | undefined) || "").toString());
        setTipoPA(((data?.tipoPA as string | undefined) || "Investigação Preliminar").toString());
        const docs = Array.isArray(data?.documentosIP)
          ? (data.documentosIP as DocumentoIP[])
          : [];
        setDocumentos(docs);
      } catch (error) {
        console.error("Erro ao carregar IP:", error);
        toast.error("Não foi possível carregar o processo.");
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, processoId]);

  // Últimas notas do /historico — onSnapshot para refletir notas recém-salvas.
  useEffect(() => {
    if (!open || !processoId) return;
    const q = query(
      collection(db, `processos/${processoId}/historico`),
      orderBy("timestamp", "desc"),
      limit(4),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const itens: NotaHistorico[] = snap.docs.map((d) => {
          const v = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            autor: (v.autor as string | undefined) || "",
            texto: (v.texto as string | undefined) || "",
            timestamp: normalizarTimestamp(v.timestamp),
          };
        });
        setUltimasNotas(itens);
      },
      // Fallback: se não houver permissão / índice, ignora silenciosamente.
      async () => {
        try {
          const snap = await getDocs(q);
          const itens: NotaHistorico[] = snap.docs.map((d) => {
            const v = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              autor: (v.autor as string | undefined) || "",
              texto: (v.texto as string | undefined) || "",
              timestamp: normalizarTimestamp(v.timestamp),
            };
          });
          setUltimasNotas(itens);
        } catch {
          setUltimasNotas([]);
        }
      },
    );
    return () => unsub();
  }, [open, processoId]);

  // ---------------- Persistência ----------------
  const avancarFluxo = async (
    novaSituacao: SituacaoFluxoIP,
    msgHistorico: string,
    isFinalizando = false,
  ) => {
    if (!processoId || !user) return;
    setSalvando(true);
    try {
      const processoRef = doc(db, "processos", processoId);
      const payload: Record<string, unknown> = {
        situacaoFluxoIP: novaSituacao,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      };
      if (isFinalizando) {
        payload.finalizado = true;
        payload.status = "concluido";
      }
      await updateDoc(processoRef, payload);
      await addDoc(collection(db, `processos/${processoId}/historico`), {
        autor: autorMilitar,
        autorId: user.uid || "sistema",
        texto: msgHistorico,
        timestamp: new Date().toISOString(),
      });
      setSituacaoAtual(novaSituacao);
      toast.success("Fluxo do processo atualizado.");
      if (onSuccess) onSuccess();
      if (isFinalizando) onOpenChange(false);
    } catch (error) {
      console.error("Erro ao avançar fluxo IP:", error);
      toast.error("Não foi possível atualizar o fluxo da IP.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarDocumento = async () => {
    if (!processoId || !user) return;
    const descricao = novaDescricaoDoc.trim();
    if (!descricao) {
      toast.error("Informe a descrição/número do documento.");
      return;
    }
    if (!novaDataDoc) {
      toast.error("Informe a data do documento.");
      return;
    }
    setSalvando(true);
    try {
      const novoDoc: DocumentoIP = {
        tipo: novoTipoDoc,
        descricao,
        data: novaDataDoc,
        registradoPor: autorMilitar,
        registradoEm: new Date().toISOString(),
      };
      await updateDoc(doc(db, "processos", processoId), {
        documentosIP: arrayUnion(novoDoc),
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: autorMilitar,
      });
      setDocumentos((prev) => [...prev, novoDoc]);
      setShowFormDoc(false);
      setNovaDescricaoDoc("");
      setNovaDataDoc(new Date().toISOString().slice(0, 10));
      setNovoTipoDoc("Expedido");
      toast.success("Documento registrado.");
    } catch (error) {
      console.error("Erro ao registrar documento IP:", error);
      toast.error("Não foi possível registrar o documento.");
    } finally {
      setSalvando(false);
    }
  };

  const registrarNota = async () => {
    if (!processoId || !user) return;
    const texto = novaNota.trim();
    if (!texto) {
      toast.error("Escreva uma nota antes de registrar.");
      return;
    }
    setSalvandoNota(true);
    try {
      await addDoc(collection(db, `processos/${processoId}/historico`), {
        autor: autorMilitar,
        autorId: user.uid || "sistema",
        texto,
        timestamp: new Date().toISOString(),
      });
      setNovaNota("");
      toast.success("Anotação registrada.");
    } catch (error) {
      console.error("Erro ao registrar nota IP:", error);
      toast.error("Não foi possível registrar a nota.");
    } finally {
      setSalvandoNota(false);
    }
  };

  // V4.0.1 — Identidade visual única.
  const PRIMARY_BTN =
    "bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const DANGER_BTN =
    "bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const SECONDARY_BTN =
    "py-2 px-3 rounded-lg text-sm font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed";
  const FORM_CONTAINER =
    "p-5 border border-slate-200 rounded-xl mb-4 bg-slate-50";

  const finalizado = situacaoAtual === "FINALIZADO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tipoPA} - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Workspace flexível do processo (V5.1).
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white p-3 flex items-center gap-2 rounded-lg border border-slate-200 mb-6 text-sm text-slate-700 shadow-sm">
          <span className="font-semibold text-slate-800">Situação atual:</span>
          <span>{LABEL_SITUACAO_IP[situacaoAtual]}</span>
          {parte && (
            <span className="ml-auto text-xs text-slate-500">Parte: {parte}</span>
          )}
        </div>

        {carregando ? (
          <div className={`${FORM_CONTAINER} text-center text-sm text-slate-600`}>
            Carregando workspace da IP...
          </div>
        ) : (
          <>
            {/* Bloco 1 — Registro de Documentos */}
            <div className={FORM_CONTAINER}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-800">
                  Registro de Documentos
                </h4>
                {!finalizado && (
                  <button
                    type="button"
                    aria-label={showFormDoc ? "Cancelar" : "Adicionar documento"}
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={salvando}
                    onClick={() => setShowFormDoc((v) => !v)}
                  >
                    {showFormDoc ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                )}
              </div>

              {documentos.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  Nenhum documento registrado ainda.
                </p>
              ) : (
                <ul className="space-y-2 mb-3">
                  {documentos.map((d, idx) => (
                    <li
                      key={`${d.descricao}-${idx}`}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 flex items-start gap-3"
                    >
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          d.tipo === "Expedido"
                            ? "bg-slate-900 text-white"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {d.tipo}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{d.descricao}</div>
                        <div className="text-[11px] text-slate-500">
                          {d.data} · {d.registradoPor}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {showFormDoc && !finalizado && (
                <div className="space-y-3 rounded-lg border border-slate-300 bg-white p-4">
                  <div>
                    <Label className="text-slate-700">Tipo</Label>
                    <Select
                      value={novoTipoDoc}
                      onValueChange={(v) =>
                        setNovoTipoDoc(v as "Expedido" | "Recebido")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Expedido">Expedido</SelectItem>
                        <SelectItem value="Recebido">Recebido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="ip-doc-desc" className="text-slate-700">
                      Descrição / Número
                    </Label>
                    <Input
                      id="ip-doc-desc"
                      type="text"
                      value={novaDescricaoDoc}
                      onChange={(e) => setNovaDescricaoDoc(e.target.value)}
                      placeholder="Ex: DiEx nº 045/2026 - Solicita oitiva"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ip-doc-data" className="text-slate-700">
                      Data
                    </Label>
                    <Input
                      id="ip-doc-data"
                      type="date"
                      value={novaDataDoc}
                      onChange={(e) => setNovaDataDoc(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={salvando}
                      className={`${PRIMARY_BTN} flex-1`}
                      onClick={() => void salvarDocumento()}
                    >
                      Salvar Documento
                    </button>
                    <button
                      type="button"
                      disabled={salvando}
                      className={SECONDARY_BTN}
                      onClick={() => {
                        setShowFormDoc(false);
                        setNovaDescricaoDoc("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 2 — Anotações */}
            <div className={FORM_CONTAINER}>
              <h4 className="text-sm font-semibold text-slate-800 mb-1">
                Anotações
              </h4>
              <p className="text-xs text-slate-600 mb-3">
                Anotações livres ficam salvas no histórico do processo.
              </p>

              {ultimasNotas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {ultimasNotas.map((n) => (
                    <li
                      key={n.id}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-600">
                          {n.autor || "—"}
                        </span>
                        <span>
                          {n.timestamp ? n.timestamp.slice(0, 16).replace("T", " ") : ""}
                        </span>
                      </div>
                      <div className="whitespace-pre-wrap break-words">{n.texto}</div>
                    </li>
                  ))}
                </ul>
              )}

              {!finalizado && (
                <div className="space-y-2">
                  <Textarea
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    placeholder="Registre uma anotação..."
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={salvandoNota || !novaNota.trim()}
                      className={SECONDARY_BTN}
                      onClick={() => void registrarNota()}
                    >
                      {salvandoNota ? "Registrando..." : "Registrar Nota"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bloco 3 — Rodapé Ping-Pong */}
            <div className={FORM_CONTAINER}>
              {situacaoAtual === "MESA_ASSESSOR" && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={salvando}
                    className={`${PRIMARY_BTN} flex-1`}
                    onClick={() =>
                      void avancarFluxo(
                        "NA_CHEFIA",
                        "Processo encaminhado para despacho com a Chefia.",
                      )
                    }
                  >
                    Encaminhar à Chefia
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    className={`${DANGER_BTN} flex-1`}
                    onClick={() =>
                      void avancarFluxo(
                        "FINALIZADO",
                        "Processo finalizado.",
                        true,
                      )
                    }
                  >
                    Finalizar Processo
                  </button>
                </div>
              )}

              {situacaoAtual === "NA_CHEFIA" && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={salvando}
                    className={`${PRIMARY_BTN} flex-1`}
                    onClick={() =>
                      void avancarFluxo(
                        "MESA_ASSESSOR",
                        "Processo devolvido ao Assessor.",
                      )
                    }
                  >
                    Devolver para Assessor
                  </button>
                  <button
                    type="button"
                    disabled={salvando}
                    className={`${DANGER_BTN} flex-1`}
                    onClick={() =>
                      void avancarFluxo(
                        "FINALIZADO",
                        "Processo finalizado pela Chefia.",
                        true,
                      )
                    }
                  >
                    Finalizar Processo
                  </button>
                </div>
              )}

              {finalizado && (
                <p className="text-center text-sm text-slate-600 font-semibold">
                  Processo Encerrado
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
