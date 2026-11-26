import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Processo } from "@/types/processo";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle2,
  Pencil,
  Save,
  X,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { calcularFaixasProrrogacaoPA, calcularPrazoAssinaturaSolucao, diasRestantes, formatarData } from "@/lib/prazo";
import { getBadgeSituacaoPA } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface DetalhesModalPAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
}

export function DetalhesModalPA({ open, onOpenChange, processo }: DetalhesModalPAProps) {
  const { user } = useAuth();
  const nomeAutorBase = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
  const autorMilitar = user?.posto ? `${user.posto} ${nomeAutorBase}`.trim() : nomeAutorBase;
  const [editandoPrazosPA, setEditandoPrazosPA] = useState(false);
  const [savingPrazosPA, setSavingPrazosPA] = useState(false);
  const [dataEntradaEdit, setDataEntradaEdit] = useState("");
  const [inicioPrazoEdit, setInicioPrazoEdit] = useState("");
  const [prazoFatalEdit, setPrazoFatalEdit] = useState("");

  // V9.21 — Documentos registrados (igual ao DU): lista editável de
  // número + data, independente das Prorrogações e do Aditamento.
  const [editandoDocumentos, setEditandoDocumentos] = useState(false);
  const [savingDocumentos, setSavingDocumentos] = useState(false);
  const [documentosEdit, setDocumentosEdit] = useState<Array<{ numero: string; data: string }>>([]);

  useEffect(() => {
    if (!open || !processo) return;
    setDataEntradaEdit(processo.dataEntrada || "");
    setInicioPrazoEdit(processo.dataInicioPrazo || "");
    setPrazoFatalEdit(processo.prazoFatal || "");
    setEditandoPrazosPA(false);
    setDocumentosEdit(
      Array.isArray(processo.documentosRegistrados)
        ? processo.documentosRegistrados.map((d) => ({ numero: d.numero || "", data: d.data || "" }))
        : [],
    );
    setEditandoDocumentos(false);
  }, [open, processo]);

  if (!processo) return null;

  const handleSalvarPrazosPA = async () => {
    try {
      setSavingPrazosPA(true);
      const processoRef = doc(db, "processos", processo.id);

      // V9.6 — Log de auditoria no chat: qualquer alteração de data deve ser
      // registrada como mensagem no histórico do processo, com autor e timestamp.
      const alteracoes: string[] = [];
      const novaDataEntrada = dataEntradaEdit || null;
      const novoInicioPrazo = inicioPrazoEdit || null;
      const novoPrazoFatal = prazoFatalEdit || null;
      if ((processo.dataEntrada || null) !== novaDataEntrada) {
        alteracoes.push(
          `Data de Entrada: ${processo.dataEntrada ? formatarData(processo.dataEntrada) : "—"} → ${novaDataEntrada ? formatarData(novaDataEntrada) : "—"}`,
        );
      }
      if ((processo.dataInicioPrazo || null) !== novoInicioPrazo) {
        alteracoes.push(
          `Início do Prazo: ${processo.dataInicioPrazo ? formatarData(processo.dataInicioPrazo) : "—"} → ${novoInicioPrazo ? formatarData(novoInicioPrazo) : "—"}`,
        );
      }
      if ((processo.prazoFatal || null) !== novoPrazoFatal) {
        alteracoes.push(
          `Prazo Fatal: ${processo.prazoFatal ? formatarData(processo.prazoFatal) : "—"} → ${novoPrazoFatal ? formatarData(novoPrazoFatal) : "—"}`,
        );
      }

      await updateDoc(processoRef, {
        dataEntrada: novaDataEntrada,
        dataInicioPrazo: novoInicioPrazo,
        prazoFatal: novoPrazoFatal,
        finalPrazo: novoPrazoFatal,
        // Override manual: o hook useProcessos recalcula prazoFatal a partir de
        // dataInicioPrazo + tipoPA. Sem este campo, a edição livre seria ignorada.
        prazoFatalOverride: novoPrazoFatal,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorNome: autorMilitar,
      });

      if (alteracoes.length > 0) {
        try {
          await addDoc(collection(db, `processos/${processo.id}/historico`), {
            autor: autorMilitar,
            autorId: user?.uid || "sistema",
            texto: `Alteração de datas — ${alteracoes.join(" | ")}`,
            timestamp: new Date().toISOString(),
          });
        } catch (logError) {
          console.warn("Não foi possível registrar log de alteração de datas no chat:", logError);
        }
      }

      setEditandoPrazosPA(false);
      toast.success("Prazos do PA atualizados com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar prazos PA:", error);
      toast.error("Não foi possível salvar os prazos.");
    } finally {
      setSavingPrazosPA(false);
    }
  };

  const handleSalvarDocumentos = async () => {
    try {
      setSavingDocumentos(true);
      const documentosLimpos = documentosEdit
        .map((d) => {
          const numero = d.numero.trim();
          const dataTrim = d.data.trim();
          const item: { numero: string; data?: string } = { numero };
          if (dataTrim) item.data = dataTrim;
          return item;
        })
        .filter((d) => d.numero.length > 0);

      const processoRef = doc(db, "processos", processo.id);
      await updateDoc(processoRef, {
        documentosRegistrados: documentosLimpos.length > 0 ? documentosLimpos : null,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorNome: autorMilitar,
      });
      setEditandoDocumentos(false);
      toast.success("Documentos atualizados com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar documentos do PA:", error);
      toast.error("Não foi possível salvar os documentos.");
    } finally {
      setSavingDocumentos(false);
    }
  };

  const adicionarDocumento = () =>
    setDocumentosEdit((atual) => [...atual, { numero: "", data: new Date().toISOString().slice(0, 10) }]);
  const removerDocumento = (index: number) =>
    setDocumentosEdit((atual) => atual.filter((_, i) => i !== index));
  const atualizarDocumento = (index: number, campo: "numero" | "data", valor: string) =>
    setDocumentosEdit((atual) => atual.map((d, i) => (i === index ? { ...d, [campo]: valor } : d)));

  const prorrogacoesPA = calcularFaixasProrrogacaoPA({
    tipoPA: processo.tipoPA,
    dataInicioPrazo: processo.dataInicioPrazo,
    dataAssinatura: processo.dataAssinatura,
    prorrogacoes: processo.prorrogacoes,
  }).map((faixa, index) => ({
    ...faixa,
    doc: processo.prorrogacoes?.[index]?.doc || "Documento não informado",
    por: processo.prorrogacoes?.[index]?.por,
    em: processo.prorrogacoes?.[index]?.em,
  }));

  const badgeSituacaoPA = getBadgeSituacaoPA({
    situacaoFluxoPA: processo.situacaoFluxoPA,
    situacaoFluxoConselho: processo.situacaoFluxoConselho,
    situacaoFluxoIP: processo.situacaoFluxoIP,
    situacaoFluxoLegado: processo.situacaoFluxo,
    status: processo.faseAtual || processo.status,
  });

  const normalizarSituacao = (valor?: string) =>
    String(valor || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const sitPA = normalizarSituacao(processo.situacaoFluxoPA);
  const emFaseSolucao = sitPA === "FAZENDO_SOLUCAO";
  const emAssinaturaSolucao = sitPA === "ASSINANDO_SOLUCAO";
  const emPrazoSolucao = emFaseSolucao || emAssinaturaSolucao;
  const diasPrazoSolucao = processo.prazoFatal ? diasRestantes(processo.prazoFatal) : null;
  // V9.22 — Uma vez despachado para assinatura, o prazo da solução/parecer
  // não se aplica mais — vira o prazo de 5 dias do Cmt para assinar.
  const prazoAssinaturaCmt = calcularPrazoAssinaturaSolucao(processo.dataDespachoAssinatura);
  const diasPrazoAssinatura = prazoAssinaturaCmt ? diasRestantes(prazoAssinaturaCmt) : null;

  // Investigação Preliminar e Outros seguem o motor IP (situacaoFluxoIP), que
  // não tem portaria nem prazo regulamentar — dataInicioPrazo/prazoFatal nunca
  // são preenchidos para esses tipos, então os campos de prazo não se aplicam.
  const tipoPANorm = normalizarSituacao(processo.tipoPA);
  const ehIPouOutrosPA = tipoPANorm === "INVESTIGACAO_PRELIMINAR" || tipoPANorm === "OUTROS";

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
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xs font-bold px-2 py-1 rounded bg-purple-100 text-purple-700">PA</span>
            <span className="text-base font-mono">{processo.numero}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes do processo PA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{processo.tipoAcao}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {processo.prioridade === "urgente" && (
                <Badge variant="destructive">URGENTE</Badge>
              )}
              {processo.tipoPA && (
                <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-300">
                  {processo.tipoPA}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={
                  processo.status === "concluido"
                    ? "bg-green-50 text-green-800 border-green-300"
                    : "bg-amber-50 text-amber-800 border-amber-300"
                }
              >
                {processo.status === "concluido" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {badgeSituacaoPA}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informações Gerais</h4>
              <InfoRow icon={User} label="Parte / Cliente" value={processo.cliente} />
              <InfoRow icon={FileText} label="Tipo PA" value={processo.tipoPA} />
              <InfoRow icon={User} label="Encarregado" value={processo.encarregado} />
              <InfoRow icon={User} label="Responsável" value={processo.responsavel} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                <Calendar className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="whitespace-nowrap">Prazos e Datas</span>
              </div>
              {ehIPouOutrosPA ? (
                <>
                  <InfoRow icon={Calendar} label="Data de Entrada" value={processo.dataEntrada ? formatarData(processo.dataEntrada) : undefined} />
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 italic">
                    Investigação Preliminar / Outros não têm prazo regulamentar fixo — segue o fluxo próprio (Mesa do Assessor → Chefia).
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 mb-2">
                    {editandoPrazosPA ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => {
                            setEditandoPrazosPA(false);
                            setDataEntradaEdit(processo.dataEntrada || "");
                            setInicioPrazoEdit(processo.dataInicioPrazo || "");
                            setPrazoFatalEdit(processo.prazoFatal || "");
                          }}
                          disabled={savingPrazosPA}
                        >
                          <X className="w-3 h-3 mr-1" /> Cancelar
                        </Button>
                        <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={handleSalvarPrazosPA} disabled={savingPrazosPA}>
                          <Save className="w-3 h-3 mr-1" /> {savingPrazosPA ? "Salvando..." : "Salvar"}
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditandoPrazosPA(true)}>
                        <Pencil className="w-3 h-3 mr-1" /> Editar
                      </Button>
                    )}
                  </div>

                  {editandoPrazosPA && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Data de Entrada</label>
                          <Input type="date" value={dataEntradaEdit} onChange={(e) => setDataEntradaEdit(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Início do Prazo</label>
                          <Input type="date" value={inicioPrazoEdit} onChange={(e) => setInicioPrazoEdit(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Prazo Fatal / Solução</label>
                          <Input type="date" value={prazoFatalEdit} onChange={(e) => setPrazoFatalEdit(e.target.value)} />
                        </div>
                      </div>
                    </div>
                  )}
                  {processo.dataEntrada && <InfoRow icon={Calendar} label="Data de Entrada" value={formatarData(processo.dataEntrada)} />}
                  <InfoRow icon={Calendar} label={emPrazoSolucao ? "Início do Prazo da Solução" : "Início do Prazo"} value={processo.dataInicioPrazo ? formatarData(processo.dataInicioPrazo) : undefined} />
                  {/* V9.6 — Prazo Fatal: sempre exibido. */}
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Prazo Fatal</div>
                      <div className="text-sm text-slate-800 mt-0.5">{processo.prazoFatal ? formatarData(processo.prazoFatal) : "—"}</div>
                    </div>
                  </div>
                  {/* V9.6 — Prazo Solução: permanece em "—" até que o encarregado entregue os autos (fase FAZENDO_SOLUCAO/ASSINANDO_SOLUCAO). */}
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Prazo Solução</div>
                      <div className="text-sm text-slate-800 mt-0.5">
                        {emPrazoSolucao && processo.prazoFatal ? formatarData(processo.prazoFatal) : "—"}
                      </div>
                    </div>
                  </div>
                  {emAssinaturaSolucao ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Prazo para Assinatura (Cmt)</div>
                      <div className="text-sm text-violet-900 mt-1">
                        {diasPrazoAssinatura === null
                          ? "Aguardando registro da data de despacho."
                          : diasPrazoAssinatura < 0
                            ? `Prazo vencido há ${Math.abs(diasPrazoAssinatura)} dia(s).`
                            : `Restam ${diasPrazoAssinatura} dia(s) para o Cmt assinar.`}
                      </div>
                    </div>
                  ) : emFaseSolucao && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Prazo da Solução/Parecer</div>
                      <div className="text-sm text-indigo-900 mt-1">
                        {diasPrazoSolucao === null
                          ? "Prazo em andamento."
                          : diasPrazoSolucao < 0
                            ? `Prazo vencido ha ${Math.abs(diasPrazoSolucao)} dia(s).`
                            : `Restam ${diasPrazoSolucao} dia(s) para confeccao da solucao.`}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="whitespace-nowrap">Prorrogações ({prorrogacoesPA.length})</span>
              </div>
              {prorrogacoesPA.length === 0 ? (
                <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                  Nenhuma prorrogação registrada.
                </div>
              ) : (
                <div className="space-y-2">
                  {prorrogacoesPA.map((item, index) => (
                    <div key={`${item.doc || "sem-doc"}-${item.em || index}`} className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm p-3">
                      <div className="text-sm font-semibold text-amber-900 break-words">{item.doc || "Documento não informado"}</div>
                      <div className="text-xs text-amber-800 mt-1">
                        Início: {formatarData(item.inicio)} | Fim: {formatarData(item.fim)} | +{item.dias ?? "?"} dias
                        {item.por ? ` | Por: ${item.por}` : ""}
                      </div>
                      {item.em && <div className="text-[10px] text-amber-700 mt-1">Registro: {formatarData(item.em)}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="whitespace-nowrap">Publicação do Aditamento</span>
              </div>
              {processo.aditamentoNumero ? (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm p-3">
                  <div className="text-sm font-semibold text-indigo-900 break-words">{processo.aditamentoNumero}</div>
                  {processo.aditamentoData && (
                    <div className="text-xs text-indigo-800 mt-1">Publicado em: {formatarData(processo.aditamentoData)}</div>
                  )}
                </div>
              ) : (
                <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                  Nenhum aditamento registrado.
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wide font-semibold mb-2 pt-2 border-t border-slate-100">
                <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="whitespace-nowrap">Documentos</span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                {editandoDocumentos ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => {
                        setEditandoDocumentos(false);
                        setDocumentosEdit(
                          Array.isArray(processo.documentosRegistrados)
                            ? processo.documentosRegistrados.map((d) => ({ numero: d.numero || "", data: d.data || "" }))
                            : [],
                        );
                      }}
                      disabled={savingDocumentos}
                    >
                      <X className="w-3 h-3 mr-1" /> Cancelar
                    </Button>
                    <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={handleSalvarDocumentos} disabled={savingDocumentos}>
                      <Save className="w-3 h-3 mr-1" /> {savingDocumentos ? "Salvando..." : "Salvar"}
                    </Button>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditandoDocumentos(true)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                )}
              </div>

              {editandoDocumentos ? (
                <div className="space-y-3">
                  {documentosEdit.length === 0 && (
                    <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                      Nenhum documento cadastrado. Clique em "Adicionar Documento".
                    </div>
                  )}
                  {documentosEdit.map((item, idx) => (
                    <div key={idx} className="p-3 border border-slate-200 bg-slate-50 rounded-lg relative shadow-sm">
                      <button
                        type="button"
                        onClick={() => removerDocumento(idx)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remover documento"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="space-y-2.5 pr-6">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Número</label>
                          <Input
                            value={item.numero}
                            onChange={(e) => atualizarDocumento(idx, "numero", e.target.value)}
                            placeholder="Ex: DIEx nº 123..."
                            className="h-8 text-xs mt-0.5"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data</label>
                          <Input
                            type="date"
                            value={item.data}
                            onChange={(e) => atualizarDocumento(idx, "data", e.target.value)}
                            className="h-8 text-xs mt-0.5"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={adicionarDocumento}
                    className="w-full text-xs h-8 border-dashed border-slate-300 text-slate-500 hover:text-slate-800"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Documento
                  </Button>
                </div>
              ) : Array.isArray(processo.documentosRegistrados) && processo.documentosRegistrados.length > 0 ? (
                <div className="space-y-2">
                  {processo.documentosRegistrados.map((docItem, idx) => (
                    <div key={`${docItem.numero}-${idx}`} className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
                      <div className="text-sm font-semibold text-slate-800 break-words">{docItem.numero}</div>
                      {docItem.data && <div className="text-xs text-slate-500 mt-1">Registrado em: {formatarData(docItem.data)}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-400 italic">
                  Nenhum documento registrado.
                </div>
              )}
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
                  {(processo.atualizadoPorNome || processo.atualizadoEm) && (
                    <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200">
                      {processo.atualizadoPorNome && <span>por {processo.atualizadoPorNome.split("@")[0]}</span>}
                      {processo.atualizadoPorNome && processo.atualizadoEm && <span> • </span>}
                      {processo.atualizadoEm && <span>{formatarDataHoraSegura(processo.atualizadoEm)}</span>}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
