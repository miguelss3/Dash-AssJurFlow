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

export function DetalhesModalDU({ open, onOpenChange, processo }: DetalhesModalDUProps) {
  const [editandoPrazosDU, setEditandoPrazosDU] = useState(false);
  const [savingPrazosDU, setSavingPrazosDU] = useState(false);
  const [prazoInternoEdit, setPrazoInternoEdit] = useState("");
  const [prazoFatalEdit, setPrazoFatalEdit] = useState("");
  const [prazoRespostaEdit, setPrazoRespostaEdit] = useState("");
  const [editandoDocs, setEditandoDocs] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [docEnviadoEdit, setDocEnviadoEdit] = useState("");
  const [docRecebidoEdit, setDocRecebidoEdit] = useState("");

  useEffect(() => {
    if (!open || !processo) return;
    setPrazoInternoEdit(processo.prazo || "");
    setPrazoFatalEdit(processo.prazoFatal || "");
    setPrazoRespostaEdit(processo.pedidoSubsidios?.prazoResposta || "");
    setEditandoPrazosDU(false);

    setDocEnviadoEdit(
      processo.pedidoSubsidios?.numeroOficioExterno
      || processo.pedidoSubsidios?.numeroDocumentoDU
      || processo.pedidoSubsidios?.numeroDiex
      || "",
    );
    setDocRecebidoEdit(
      processo.respostaDU?.numeroOficioExterno
      || processo.respostaDU?.numeroDiex
      || processo.respostaDU?.numeroOficio
      || "",
    );
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

  const formatarDataHoraSegura = (valor?: string | null) => {
    if (!valor) return "—";
    try {
      const data = new Date(valor);
      if (Number.isNaN(data.getTime())) return "—";
      return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
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

  const handleSalvarDocs = async () => {
    try {
      setSavingDocs(true);
      const enviado = docEnviadoEdit.trim();
      let recebido = docRecebidoEdit.trim();

      if (enviado && recebido && enviado === recebido) {
        const confirmar = typeof window !== "undefined"
          ? window.confirm(
              "O número informado em 'Recebido' é igual ao 'Enviado'. "
                + "Um DIEx da Assessoria não pode ser também um recebimento da Unidade. "
                + "Deseja limpar o campo 'Recebido'?",
            )
          : true;
        if (!confirmar) {
          setSavingDocs(false);
          return;
        }
        recebido = "";
        setDocRecebidoEdit("");
      }

      const processoRef = doc(db, "processos", processo.id);
      await updateDoc(processoRef, sanitizarPatch({
        "pedidoSubsidios.numeroDocumentoDU": enviado,
        "pedidoSubsidios.numeroDiex": enviado,
        "respostaDU.numeroDiex": recebido,
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
                          setDocEnviadoEdit(
                            processo.pedidoSubsidios?.numeroOficioExterno
                            || processo.pedidoSubsidios?.numeroDocumentoDU
                            || processo.pedidoSubsidios?.numeroDiex
                            || "",
                          );
                          setDocRecebidoEdit(
                            processo.respostaDU?.numeroOficioExterno
                            || processo.respostaDU?.numeroDiex
                            || processo.respostaDU?.numeroOficio
                            || "",
                          );
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
                // Mapeia o histórico completo de envios (array de documentos)
                const historicoEnviado = pedido?.numeroDiexHistorico || [];
                const docRecebido =
                  respostaDU?.numeroOficioExterno ||
                  respostaDU?.numeroDiex ||
                  respostaDU?.numeroOficio ||
                  "";

                return (
                  <>
                    <div className="flex items-start gap-3">
                      <ArrowUpRight className="w-4 h-4 text-sky-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Enviados (Histórico)</div>
                        {editandoDocs ? (
                          <Input value={docEnviadoEdit} onChange={(e) => setDocEnviadoEdit(e.target.value)} placeholder="Nº DIEx enviado" className="mt-1 h-8 text-sm" />
                        ) : (
                          <ul className="list-disc pl-4 mt-1 space-y-1">
                            {historicoEnviado.length > 0 ? (
                              historicoEnviado.map((doc, idx) => (
                                <li key={idx} className="text-sm text-slate-800 font-medium">{doc}</li>
                              ))
                            ) : (
                              <li className="text-sm text-slate-400 italic">Pendente</li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 mt-4">
                      <ArrowDownLeft className="w-4 h-4 text-sky-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Recebido</div>
                        {editandoDocs ? (
                          <Input value={docRecebidoEdit} onChange={(e) => setDocRecebidoEdit(e.target.value)} placeholder="Nº DIEx recebido" className="mt-1 h-8 text-sm" />
                        ) : (
                          <div className={`text-sm mt-0.5 ${docRecebido ? "text-slate-800 font-medium" : "text-slate-400 italic"}`}>
                            {docRecebido || "Pendente"}
                          </div>
                        )}
                      </div>
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

          {pedido && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                  {(pedido.reiteracoes ?? 0) > 0 ? `Pedido de Subsídios (${pedido.reiteracoes}ª Reiteração)` : "Pedido de Subsídios"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <InfoRow icon={Mail} label="DIEx / Documento" value={pedido.numeroOficioExterno || pedido.numeroDocumentoDU || pedido.numeroDiex || "Pendente"} />
                  <InfoRow icon={Calendar} label="Data do Pedido" value={formatarDataHoraSegura(dataPedidoDU)} />
                  <InfoRow icon={Clock} label="Prazo de Resposta" value={pedido.dataPrazo ? formatarData(pedido.dataPrazo) : pedido.prazoResposta ? formatarData(pedido.prazoResposta) : "—"} />
                  {processo.status !== "concluido" && <InfoRow icon={AlertCircle} label="Situação" value={badgeSituacaoDU} />}
                </div>
              </div>
            </>
          )}

          {processo.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Observações</h4>
                <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">{processo.observacoes}</div>
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
