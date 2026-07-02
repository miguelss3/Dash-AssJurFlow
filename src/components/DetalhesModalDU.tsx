import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Processo } from "@/types/processo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  User,
  Mail,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Save,
  X,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  type LucideIcon,
} from "lucide-react";
import { formatarData, diasRestantes } from "@/lib/prazo";
import { getBadgeSituacaoDUContextual } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface DetalhesModalDUProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
}

// Extrai a data civil (YYYY-MM-DD) de um valor salvo, seja ele já uma data
// "pura" (sem hora) ou um timestamp ISO completo. Nunca interpreta uma data
// sem fuso como UTC — isso é o que causava o dia/hora errados na tela (ex.:
// "2026-07-02" virando "01/07/2026, 20:00" ao passar por new Date()).
function dataSomente(valor?: string | null): string {
  if (!valor) return "";
  const soData = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (soData) return valor;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor.length >= 10 ? valor.slice(0, 10) : "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Data civil de hoje (fuso local), no formato YYYY-MM-DD.
function dataCivilAtual(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Mapeia o histórico do Firestore (strings legadas OU objetos) para o
// formato uniforme usado no editor.
function mapearHistoricoParaForm(
  raw: Array<string | { numero?: string; dataEnvio?: string; prazo?: string; nomeDocumento?: string }> | undefined,
): Array<{ numero: string; dataEnvio: string; prazo: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.map((doc) => {
    if (typeof doc === "string") {
      return { numero: doc, dataEnvio: "", prazo: "" };
    }
    return {
      numero: doc?.numero || doc?.nomeDocumento || "",
      dataEnvio: dataSomente(doc?.dataEnvio || ""),
      prazo: doc?.prazo || "",
    };
  });
}

export function DetalhesModalDU({ open, onOpenChange, processo }: DetalhesModalDUProps) {
  const [editandoPrazosDU, setEditandoPrazosDU] = useState(false);
  const [savingPrazosDU, setSavingPrazosDU] = useState(false);
  const [prazoInternoEdit, setPrazoInternoEdit] = useState("");
  const [prazoFatalEdit, setPrazoFatalEdit] = useState("");
  const [prazoRespostaEdit, setPrazoRespostaEdit] = useState("");
  const [editandoDocs, setEditandoDocs] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [historicoEdit, setHistoricoEdit] = useState<
    Array<{ numero: string; dataEnvio: string; prazo: string }>
  >([]);
  const [recebidosEdit, setRecebidosEdit] = useState<Array<{ numero: string; dataRecebimento: string }>>([]);

  useEffect(() => {
    if (!open || !processo) return;
    setPrazoInternoEdit(processo.prazo || "");
    setPrazoFatalEdit(processo.prazoFatal || "");
    setPrazoRespostaEdit(processo.pedidoSubsidios?.prazoResposta || "");
    setEditandoPrazosDU(false);

    setHistoricoEdit(mapearHistoricoParaForm(processo.pedidoSubsidios?.numeroDiexHistorico));

    // Inicializa lista de recebidos: usa historicoRecebidos se existir,
    // caso contrário migra o campo legado para um array de 1 item.
    const historicoRec = processo.pedidoSubsidios?.historicoRecebidos;
    if (Array.isArray(historicoRec) && historicoRec.length > 0) {
      setRecebidosEdit(historicoRec.map((r) => ({ numero: r.numero || "", dataRecebimento: dataSomente(r.dataRecebimento) })));
    } else {
      const numLegado =
        processo.respostaDU?.numeroOficioExterno
        || processo.respostaDU?.numeroDiex
        || processo.respostaDU?.numeroOficio
        || processo.pedidoSubsidios?.numeroRecebido
        || "";
      const dataLegado = processo.respostaDU?.registradoEm || processo.pedidoSubsidios?.dataRecebido || "";
      setRecebidosEdit(numLegado ? [{ numero: numLegado, dataRecebimento: dataSomente(dataLegado) }] : []);
    }
    setEditandoDocs(false);
  }, [open, processo]);

  if (!processo) return null;

  const sanitizarPatch = <T extends Record<string, unknown>>(patch: T): T => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) out[k] = null;
      else if (typeof v === "string" && v.trim() === "") out[k] = null;
      else out[k] = v;
    }
    return out as T;
  };

  // Exibe só a data (sem hora) e nunca interpreta a data como UTC — evita o
  // dia "recuar" um a menos quando o fuso local é negativo (ex.: Brasília).
  const formatarDataCivil = (valor?: string | null) => {
    const ymd = dataSomente(valor);
    if (!ymd) return "—";
    const [ano, mes, dia] = ymd.split("-");
    return `${dia}/${mes}/${ano.slice(2)}`;
  };

  const handleSalvarPrazosDU = async () => {
    try {
      setSavingPrazosDU(true);
      const processoRef = doc(db, "processos", processo.id);
      await updateDoc(processoRef, sanitizarPatch({
        prazo: prazoInternoEdit,
        prazoFatal: prazoFatalEdit,
        "pedidoSubsidios.prazoResposta": prazoRespostaEdit,
        atualizadoEm: new Date().toISOString(),
      }));
      setEditandoPrazosDU(false);
      toast.success("Prazos finais do DU atualizados com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar prazos DU:", error);
      toast.error("Não foi possível salvar os prazos finais do DU.");
    } finally {
      setSavingPrazosDU(false);
    }
  };

  // Abre o picker nativo do <input type="date"|"datetime-local"> de forma
  // confiável dentro do Dialog (alguns navegadores não disparam ao clique).
  const abrirPickerNativo = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
    if (typeof el.showPicker === "function") {
      try { el.showPicker(); } catch { /* alguns browsers exigem gesto direto */ }
    }
  };

  const handleSalvarDocs = async () => {
    try {
      setSavingDocs(true);

      // Normaliza o histórico: descarta itens vazios. dataEnvio já é uma data
      // civil (YYYY-MM-DD), sem conversão para ISO — evita o bug de fuso
      // horário que fazia a data/hora aparecerem erradas na tela.
      // Mantém `prazo` apenas quando preenchido — evita gravar string vazia.
      const historicoLimpo = historicoEdit
        .map((h) => {
          const numero = h.numero.trim();
          const dataEnvioSomente = dataSomente(h.dataEnvio.trim());
          const prazoTrim = h.prazo.trim();
          const item: { numero: string; dataEnvio?: string; prazo?: string } = { numero };
          if (dataEnvioSomente) item.dataEnvio = dataEnvioSomente;
          if (prazoTrim) item.prazo = prazoTrim;
          return item;
        })
        .filter((h) => h.numero.length > 0);

      // Bloqueia duplicidade dentro da lista de Enviados do próprio card.
      const vistosEnvio = new Set<string>();
      const duplicadoEnvio = historicoLimpo.find((h) => {
        const chave = h.numero.toLowerCase();
        if (vistosEnvio.has(chave)) return true;
        vistosEnvio.add(chave);
        return false;
      });
      if (duplicadoEnvio) {
        toast.error(`O documento "${duplicadoEnvio.numero}" já está na lista de Enviados. Remova a repetição antes de salvar.`);
        setSavingDocs(false);
        return;
      }

      const ultimoEnviado =
        historicoLimpo.length > 0 ? historicoLimpo[historicoLimpo.length - 1].numero : "";

      // Limpa e valida a lista de recebidos
      const recebidosLimpos = recebidosEdit
        .map((r) => ({
          numero: r.numero.trim(),
          dataRecebimento: dataSomente(r.dataRecebimento.trim()),
        }))
        .filter((r) => r.numero.length > 0);

      // Bloqueia duplicidade dentro da lista de Recebidos do próprio card.
      const vistosRecebido = new Set<string>();
      const duplicadoRecebido = recebidosLimpos.find((r) => {
        const chave = r.numero.toLowerCase();
        if (vistosRecebido.has(chave)) return true;
        vistosRecebido.add(chave);
        return false;
      });
      if (duplicadoRecebido) {
        toast.error(`O documento "${duplicadoRecebido.numero}" já está na lista de Recebidos. Remova a repetição antes de salvar.`);
        setSavingDocs(false);
        return;
      }

      // Mantém o primeiro item como campo legado para compatibilidade
      const primarioRecebido = recebidosLimpos[0] ?? { numero: "", dataRecebimento: "" };
      let recebido = primarioRecebido.numero;
      const recebidoData = primarioRecebido.dataRecebimento;

      if (ultimoEnviado && recebido && ultimoEnviado === recebido) {
        const confirmar = typeof window !== "undefined"
          ? window.confirm(
              "O número informado em 'Recebido' é igual ao último 'Enviado'. "
                + "Um DIEx da Assessoria não pode ser também um recebimento da Unidade. "
                + "Deseja limpar o campo 'Recebido'?",
            )
          : true;
        if (!confirmar) {
          setSavingDocs(false);
          return;
        }
        recebido = "";
        setRecebidosEdit([]);
      }

      const processoRef = doc(db, "processos", processo.id);
      await updateDoc(processoRef, sanitizarPatch({
        "pedidoSubsidios.numeroDocumentoDU": ultimoEnviado,
        "pedidoSubsidios.numeroDiex": ultimoEnviado,
        "pedidoSubsidios.numeroDiexHistorico": historicoLimpo,
        "pedidoSubsidios.historicoRecebidos": recebidosLimpos.length > 0 ? recebidosLimpos : null,
        "respostaDU.numeroDiex": recebido,
        "respostaDU.numeroOficioExterno": recebido,
        "pedidoSubsidios.numeroRecebido": recebido,
        "respostaDU.registradoEm": recebido ? (recebidoData || null) : null,
        atualizadoEm: new Date().toISOString(),
      }));
      setEditandoDocs(false);
      toast.success("Documentos atualizados com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar documentos DU:", error);
      toast.error("Não foi possível salvar os documentos.");
    } finally {
      setSavingDocs(false);
    }
  };

  const handleHistoricoChange = (
    index: number,
    campo: "numero" | "dataEnvio" | "prazo",
    valor: string,
  ) => {
    setHistoricoEdit((atual) => {
      const novo = [...atual];
      novo[index] = { ...novo[index], [campo]: valor };
      return novo;
    });
  };
  const adicionarItemHistorico = () =>
    setHistoricoEdit((atual) => [...atual, { numero: "", dataEnvio: dataCivilAtual(), prazo: "" }]);
  const removerItemHistorico = (index: number) =>
    setHistoricoEdit((atual) => atual.filter((_, i) => i !== index));

  const pedido = processo.pedidoSubsidios;
  const respostaDU = processo.respostaDU;
  const badgeSituacaoDU = getBadgeSituacaoDUContextual({
    situacaoFluxo: pedido?.situacaoFluxo,
    status: processo.status,
    responsavel: processo.responsavel,
  });

  const dataPedidoDU = (() => {
    if (!pedido) return undefined;
    if (pedido.tipoDiligencia === "INTERNO") {
      return pedido.assinaturaChefiaEm || pedido.solicitadoEm;
    }
    if (pedido.tipoDiligencia === "EXTERNO") {
      return pedido.assinaturaChemEm || pedido.solicitadoEm;
    }
    return pedido.solicitadoEm;
  })();

  const prazoItens = [
    processo.prazo ? { tipo: "interno" as const, label: "Prazo Interno", valor: processo.prazo } : null,
    processo.prazoFatal ? { tipo: "fatal" as const, label: "Prazo Fatal", valor: processo.prazoFatal } : null,
    processo.pedidoSubsidios?.prazoResposta
      ? { tipo: "subsidios" as const, label: "Prazo Subsídios", valor: processo.pedidoSubsidios.prazoResposta }
      : null,
  ]
    .filter((item): item is { tipo: "interno" | "fatal" | "subsidios"; label: string; valor: string } => Boolean(item))
    .sort((a, b) => {
      const dataA = new Date(a.valor).getTime();
      const dataB = new Date(b.valor).getTime();
      const invalidaA = Number.isNaN(dataA);
      const invalidaB = Number.isNaN(dataB);
      if (invalidaA && invalidaB) return 0;
      if (invalidaA) return 1;
      if (invalidaB) return -1;
      return dataA - dataB;
    });

  const InfoRow = ({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3">
        <Icon className="w-4 h-4 text-slate-400 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{label}</div>
          <div className="text-sm text-slate-800 mt-0.5">{value}</div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xs font-bold px-2 py-1 rounded bg-sky-100 text-sky-700">DU</span>
            <span className="text-base font-mono">{processo.numero}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes do processo DU.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{processo.tipoAcao}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {processo.prioridade && (
                <Badge variant={processo.prioridade === "urgente" ? "destructive" : "secondary"}>
                  {processo.prioridade === "urgente" ? "URGENTE" : "Normal"}
                </Badge>
              )}
              {processo.isMS && (
                <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Mandado de Segurança</Badge>
              )}
              {processo.status !== "concluido" && (
                <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200">{badgeSituacaoDU}</Badge>
              )}
              {(pedido?.reiteracoes ?? 0) > 0 && (
                <Badge variant="outline" className="bg-orange-100 text-orange-900 border-orange-300 font-semibold">{pedido?.reiteracoes}ª Reiteração</Badge>
              )}
              {processo.status === "concluido" && (
                <Badge variant="outline"><CheckCircle2 className="w-3 h-3 mr-1" />{processo.status}</Badge>
              )}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informações Gerais</h4>
              <InfoRow icon={User} label="Parte / Cliente" value={processo.cliente} />
              <InfoRow icon={Mail} label="Origem" value={processo.origemDU} />
              <InfoRow icon={Building2} label="Seção" value={processo.secaoDU} />
              <InfoRow icon={User} label="Responsável" value={processo.responsavel} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Documentos</h4>
                <div className="flex items-center gap-2">
                  {editandoDocs ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditandoDocs(false);
                          setHistoricoEdit(
                            mapearHistoricoParaForm(processo.pedidoSubsidios?.numeroDiexHistorico),
                          );
                          // Reinicializa lista de recebidos (mesma lógica do useEffect)
                          const historicoRec = processo.pedidoSubsidios?.historicoRecebidos;
                          if (Array.isArray(historicoRec) && historicoRec.length > 0) {
                            setRecebidosEdit(historicoRec.map((r) => ({ numero: r.numero || "", dataRecebimento: dataSomente(r.dataRecebimento) })));
                          } else {
                            const numLegado =
                              processo.respostaDU?.numeroOficioExterno
                              || processo.respostaDU?.numeroDiex
                              || processo.respostaDU?.numeroOficio
                              || processo.pedidoSubsidios?.numeroRecebido
                              || "";
                            const dataLegado = processo.respostaDU?.registradoEm || processo.pedidoSubsidios?.dataRecebido || "";
                            setRecebidosEdit(numLegado ? [{ numero: numLegado, dataRecebimento: dataSomente(dataLegado) }] : []);
                          }
                        }}
                        disabled={savingDocs}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button type="button" size="sm" onClick={handleSalvarDocs} disabled={savingDocs}>
                        <Save className="w-3.5 h-3.5 mr-1" /> {savingDocs ? "Salvando..." : "Salvar"}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditandoDocs(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar documentos
                    </Button>
                  )}
                </div>
              </div>

              {(() => {
                // Histórico completo de envios (array de Nº DIEx). Ordem do array =
                // ordem cronológica de envio (mais antigo primeiro).
                const historicoEnviado = pedido?.numeroDiexHistorico || [];
                const docRecebido =
                  respostaDU?.numeroOficioExterno ||
                  respostaDU?.numeroDiex ||
                  respostaDU?.numeroOficio ||
                  pedido?.numeroRecebido ||
                  "";
                const prazoRespostaDoc = pedido?.prazoResposta;
                const diasResposta = prazoRespostaDoc ? diasRestantes(prazoRespostaDoc) : null;
                const respondido = !!docRecebido;

                const rotuloPorIndice = (idx: number, total: number) => {
                  if (idx === 0) return "Pedido Original";
                  return `${idx}ª Reiteração`;
                  // (total apenas para futuras evoluções; mantido por simetria)
                  void total;
                };

                return (
                  <>
                    {/* ENVIADOS — um card por documento do histórico */}
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                        <ArrowUpRight className="w-4 h-4 text-sky-500" />
                        Enviados (Histórico)
                      </div>

                      {editandoDocs ? (
                        <div className="space-y-3 mt-2">
                          {historicoEdit.length === 0 && (
                            <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                              Nenhum documento cadastrado. Clique em “Adicionar Documento”.
                            </div>
                          )}
                          {historicoEdit.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-3 border border-slate-200 bg-slate-50 rounded-lg relative shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={() => removerItemHistorico(idx)}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remover documento"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="space-y-2.5 pr-6">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número DIEx</label>
                                  <Input
                                    value={item.numero}
                                    onChange={(e) => handleHistoricoChange(idx, "numero", e.target.value)}
                                    placeholder="Ex: DIEx nº 123..."
                                    className="h-8 text-xs mt-0.5"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data de Envio</label>
                                    <Input
                                      type="date"
                                      value={item.dataEnvio}
                                      onChange={(e) => handleHistoricoChange(idx, "dataEnvio", e.target.value)}
                                      onClick={abrirPickerNativo}
                                      onFocus={abrirPickerNativo}
                                      className="h-8 text-xs mt-0.5 cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Prazo do Doc</label>
                                    <Input
                                      type="date"
                                      value={item.prazo}
                                      onChange={(e) => handleHistoricoChange(idx, "prazo", e.target.value)}
                                      onClick={abrirPickerNativo}
                                      onFocus={abrirPickerNativo}
                                      className="h-8 text-xs mt-0.5 cursor-pointer"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={adicionarItemHistorico}
                            className="w-full text-xs h-8 border-dashed border-slate-300 text-slate-500 hover:text-slate-800"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Documento
                          </Button>
                        </div>
                      ) : historicoEnviado.length > 0 ? (
                        <div className="space-y-2">
                          {historicoEnviado.map((doc, idx) => {
                            const ehUltimo = idx === historicoEnviado.length - 1;
                            const vencido =
                              ehUltimo && !respondido && diasResposta !== null && diasResposta < 0;
                            const corBorda = vencido
                              ? "border-red-200 bg-red-50"
                              : "border-slate-200 bg-white";

                            // Suporte a entradas legadas (string) e ao novo
                            // formato estruturado { numero, dataEnvio, prazo }.
                            const ehObjeto = typeof doc === "object" && doc !== null;
                            const numeroDoc = ehObjeto
                              ? (doc.numero || doc.nomeDocumento || "Documento sem número")
                              : doc;
                            const dataEnvio = ehObjeto ? doc.dataEnvio : undefined;
                            const prazoDoc = ehObjeto && doc.prazo ? doc.prazo : prazoRespostaDoc;

                            return (
                              <div
                                key={`${numeroDoc}-${idx}`}
                                className={`rounded-xl border ${corBorda} shadow-sm p-3 hover:border-sky-300 transition-colors`}
                              >
                                <div className="flex items-start gap-3">
                                  <ArrowUpRight className="w-4 h-4 text-sky-600 mt-1 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 break-words">
                                      {numeroDoc}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs">
                                  <span className="text-slate-500">Enviado em:</span>
                                  <span className="font-medium text-slate-700">
                                    {formatarDataCivil(dataEnvio)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                          Nenhum documento enviado.
                        </div>
                      )}
                    </div>

                    {/* RECEBIDO */}
                    <div className="mt-4">
                      <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                        <ArrowDownLeft className="w-4 h-4 text-sky-500" />
                        Recebidos (Histórico)
                      </div>
                      {editandoDocs ? (
                        <div className="space-y-3 mt-2">
                          {recebidosEdit.length === 0 && (
                            <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                              Nenhum documento recebido. Clique em "Adicionar Recebido".
                            </div>
                          )}
                          {recebidosEdit.map((item, idx) => (
                            <div
                              key={idx}
                              className="p-3 border border-slate-200 bg-slate-50 rounded-lg relative shadow-sm"
                            >
                              <button
                                type="button"
                                onClick={() => setRecebidosEdit((prev) => prev.filter((_, i) => i !== idx))}
                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remover documento recebido"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <div className="space-y-2.5 pr-6">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número do Documento Recebido</label>
                                  <Input
                                    value={item.numero}
                                    onChange={(e) => setRecebidosEdit((prev) => prev.map((r, i) => i === idx ? { ...r, numero: e.target.value } : r))}
                                    placeholder="Nº do DIEx, Ofício ou documento de retorno"
                                    className="h-8 text-xs mt-0.5"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data de Recebimento</label>
                                  <Input
                                    type="date"
                                    value={item.dataRecebimento}
                                    onChange={(e) => setRecebidosEdit((prev) => prev.map((r, i) => i === idx ? { ...r, dataRecebimento: e.target.value } : r))}
                                    onClick={abrirPickerNativo}
                                    onFocus={abrirPickerNativo}
                                    className="h-8 text-xs mt-0.5 cursor-pointer"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setRecebidosEdit((prev) => [...prev, { numero: "", dataRecebimento: dataCivilAtual() }])}
                            className="w-full text-xs h-8 border-dashed border-slate-300 text-slate-500 hover:text-slate-800"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Recebido
                          </Button>
                        </div>
                      ) : (() => {
                        // Lista de exibição: prioriza historicoRecebidos, fallback ao campo legado
                        const listaRecebidos: Array<{ numero: string; dataRecebimento: string }> =
                          Array.isArray(processo.pedidoSubsidios?.historicoRecebidos) && processo.pedidoSubsidios!.historicoRecebidos!.length > 0
                            ? processo.pedidoSubsidios!.historicoRecebidos!
                            : (docRecebido ? [{ numero: docRecebido, dataRecebimento: processo.respostaDU?.registradoEm || processo.pedidoSubsidios?.dataRecebido || "" }] : []);

                        return listaRecebidos.length > 0 ? (
                          <div className="space-y-2">
                            {listaRecebidos.map((rec, idx) => (
                              <div
                                key={`${rec.numero}-${idx}`}
                                className="rounded-xl border border-slate-200 bg-white shadow-sm p-3 hover:border-sky-300 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <ArrowDownLeft className="w-4 h-4 text-sky-600 mt-1 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-slate-800 break-words">
                                      {rec.numero}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs">
                                  <span className="text-slate-500">Recebido em:</span>
                                  <span className="font-medium text-slate-700">
                                    {formatarDataCivil(rec.dataRecebimento)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                            Pendente
                          </div>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Prazos e Datas</h4>
                <div className="flex items-center gap-2">
                  {editandoPrazosDU ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditandoPrazosDU(false);
                          setPrazoInternoEdit(processo.prazo || "");
                          setPrazoFatalEdit(processo.prazoFatal || "");
                          setPrazoRespostaEdit(processo.pedidoSubsidios?.prazoResposta || "");
                        }}
                        disabled={savingPrazosDU}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button type="button" size="sm" onClick={handleSalvarPrazosDU} disabled={savingPrazosDU}>
                        <Save className="w-3.5 h-3.5 mr-1" /> {savingPrazosDU ? "Salvando..." : "Salvar"}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditandoPrazosDU(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar prazos DU
                    </Button>
                  )}
                </div>
              </div>

              {processo.dataEntrada && <InfoRow icon={Calendar} label="Data de Entrada" value={formatarData(processo.dataEntrada)} />}

              {editandoPrazosDU && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Prazo Interno</label>
                      <Input type="date" value={prazoInternoEdit} onChange={(e) => setPrazoInternoEdit(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Prazo Fatal</label>
                      <Input type="date" value={prazoFatalEdit} onChange={(e) => setPrazoFatalEdit(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Prazo Subsídios</label>
                      <Input type="date" value={prazoRespostaEdit} onChange={(e) => setPrazoRespostaEdit(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {prazoItens.map((item) => {
                const dias = diasRestantes(item.valor);
                const isFatal = item.tipo === "fatal";
                const icone = isFatal
                  ? <AlertCircle className={`w-4 h-4 mt-0.5 ${dias <= 5 ? "text-red-500" : "text-orange-500"}`} />
                  : <Clock className={`w-4 h-4 mt-0.5 ${item.tipo === "subsidios" ? "text-indigo-500" : "text-blue-500"}`} />;

                return (
                  <div key={item.tipo} className="flex items-start gap-3">
                    {icone}
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{item.label}</div>
                      <div className={`text-sm mt-0.5 flex items-center gap-2 ${isFatal ? (dias <= 5 ? "text-red-600 font-bold" : "text-orange-600") : "text-slate-800"}`}>
                        {formatarData(item.valor)}
                        {dias > 0 && (
                          <Badge variant={isFatal && dias <= 5 ? "destructive" : "outline"} className="text-[10px]">{dias} dias restantes</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {processo.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Observações</h4>
                <div
                  className="text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-200 leading-relaxed
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
                    [&_b]:font-bold [&_strong]:font-bold
                    [&_i]:italic [&_em]:italic
                    [&_u]:underline [&_s]:line-through"
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processo.observacoes ?? "") }}
                />
              </div>
            </>
          )}

          {processo.descricao && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Último Movimento</h4>
                <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="leading-relaxed">{processo.descricao}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
