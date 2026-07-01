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
  type LucideIcon,
} from "lucide-react";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { calcularFaixasProrrogacaoPA, diasRestantes, formatarData } from "@/lib/prazo";
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

  useEffect(() => {
    if (!open || !processo) return;
    setDataEntradaEdit(processo.dataEntrada || "");
    setInicioPrazoEdit(processo.dataInicioPrazo || "");
    setPrazoFatalEdit(processo.prazoFatal || "");
    setEditandoPrazosPA(false);
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
  const emPrazoSolucao = sitPA === "FAZENDO_SOLUCAO" || sitPA === "ASSINANDO_SOLUCAO";
  const diasPrazoSolucao = processo.prazoFatal ? diasRestantes(processo.prazoFatal) : null;

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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
              {processo.prioridade && (
                <Badge variant={processo.prioridade === "urgente" ? "destructive" : "secondary"}>
                  {processo.prioridade === "urgente" ? "URGENTE" : "Normal"}
                </Badge>
              )}
              {processo.status && (
                <Badge variant="outline">
                  {processo.status === "concluido" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {processo.status}
                </Badge>
              )}
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                {badgeSituacaoPA}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informações Gerais</h4>
              <InfoRow icon={User} label="Parte / Cliente" value={processo.cliente} />
              <InfoRow icon={FileText} label="Tipo PA" value={processo.tipoPA} />
              <InfoRow icon={User} label="Encarregado" value={processo.encarregado} />
              <InfoRow icon={User} label="Responsável" value={processo.responsavel} />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Prazos e Datas</h4>
                <div className="flex items-center gap-2">
                  {editandoPrazosPA ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditandoPrazosPA(false);
                          setDataEntradaEdit(processo.dataEntrada || "");
                          setInicioPrazoEdit(processo.dataInicioPrazo || "");
                          setPrazoFatalEdit(processo.prazoFatal || "");
                        }}
                        disabled={savingPrazosPA}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </Button>
                      <Button type="button" size="sm" onClick={handleSalvarPrazosPA} disabled={savingPrazosPA}>
                        <Save className="w-3.5 h-3.5 mr-1" /> {savingPrazosPA ? "Salvando..." : "Salvar"}
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditandoPrazosPA(true)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar prazos
                    </Button>
                  )}
                </div>
              </div>

              {editandoPrazosPA && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              {emPrazoSolucao && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-700">Prazo da Solução (Mesa do Assessor)</div>
                  <div className="text-sm text-indigo-900 mt-1">
                    {diasPrazoSolucao === null
                      ? "Prazo em andamento."
                      : diasPrazoSolucao < 0
                        ? `Prazo vencido ha ${Math.abs(diasPrazoSolucao)} dia(s).`
                        : `Restam ${diasPrazoSolucao} dia(s) para confeccao da solucao.`}
                  </div>
                </div>
              )}
            </div>
          </div>

          {prorrogacoesPA.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-3">
                  Prorrogações Registradas ({prorrogacoesPA.length})
                </h4>
                <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  {prorrogacoesPA.map((item, index) => (
                    <div key={`${item.doc || "sem-doc"}-${item.em || index}`} className="text-sm text-amber-900 bg-white border border-amber-100 rounded p-3">
                      <div className="font-semibold">{item.doc || "Documento não informado"}</div>
                      <div className="text-xs text-amber-800 mt-1">
                        Início: {formatarData(item.inicio)} | Fim: {formatarData(item.fim)} | +{item.dias ?? "?"} dias
                        {item.por ? ` | Por: ${item.por}` : ""}
                      </div>
                      {item.em && <div className="text-[10px] text-amber-700 mt-1">Registro: {formatarData(item.em)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

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
