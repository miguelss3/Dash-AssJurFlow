import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Processo } from "@/types/processo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Calendar, 
  User, 
  FileText, 
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
import { calcularFaixasProrrogacaoPA, formatarData, diasRestantes } from "@/lib/prazo";
import { getBadgeSituacaoDU } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

interface DetalhesProcessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
}

export function DetalhesProcessoModal({ open, onOpenChange, processo }: DetalhesProcessoModalProps) {
  const [editandoPrazosDU, setEditandoPrazosDU] = useState(false);
  const [savingPrazosDU, setSavingPrazosDU] = useState(false);
  const [prazoInternoEdit, setPrazoInternoEdit] = useState("");
  const [prazoFatalEdit, setPrazoFatalEdit] = useState("");
  const [prazoRespostaEdit, setPrazoRespostaEdit] = useState("");
  // V2.21 — Edição inline dos números de DIEx (enviado/recebido).
  const [editandoDocs, setEditandoDocs] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [docEnviadoEdit, setDocEnviadoEdit] = useState("");
  const [docRecebidoEdit, setDocRecebidoEdit] = useState("");

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

  const setor = processo?.setor || processo?.tipo;
  const isDU = setor === "DU";
  const isPA = setor === "PA";

  useEffect(() => {
    if (!open || !processo) return;
    setPrazoInternoEdit(processo.prazo || "");
    setPrazoFatalEdit(processo.prazoFatal || "");
    setPrazoRespostaEdit(processo.pedidoSubsidios?.prazoResposta || "");
    setEditandoPrazosDU(false);
    // V2.21 — Sincroniza buffers de edição dos documentos.
    setDocEnviadoEdit(
      processo.pedidoSubsidios?.numeroDocumentoDU ||
        processo.pedidoSubsidios?.numeroDiex ||
        "",
    );
    setDocRecebidoEdit(
      processo.respostaDU?.numeroDiex ||
        processo.respostaDU?.numeroOficio ||
        "",
    );
    setEditandoDocs(false);
  }, [open, processo]);

  // Guarda defensiva: o modal pode ser disparado a partir do calendário com um
  // evento manual sem processo atrelado. Sem este early return, qualquer leitura
  // de `processo.id`, `processo.prorrogacoes` etc. abaixo lança TypeError.
  // Mantido APÓS os hooks para não violar as Regras dos Hooks do React.
  if (!processo) return null;

  // V2.23 — Sanitização: o Firestore rejeita `undefined` em writes
  // ("Unsupported field value: undefined"). Esta função normaliza
  // qualquer valor undefined ou string vazia para `null`, mantendo a
  // semântica de "campo apagado" sem quebrar o updateDoc.
  const sanitizarPatch = <T extends Record<string, unknown>>(patch: T): T => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) out[k] = null;
      else if (typeof v === "string" && v.trim() === "") out[k] = null;
      else out[k] = v;
    }
    return out as T;
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

  // V2.21 — Persistência inline dos números de DIEx (enviado/recebido).
  // V2.22 — Isolamento estrito: o ENVIADO só toca pedidoSubsidios; o
  // RECEBIDO só toca respostaDU. Se o usuário digitar o mesmo número nos
  // dois lados (entrada incoerente que originou o bug visual), o RECEBIDO
  // é higienizado para preservar a semântica "DIEx da Assessoria nunca
  // pode ser, ao mesmo tempo, recebimento da Unidade".
  const handleSalvarDocs = async () => {
    if (!processo) return;
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
  const prorrogacoesPA = isPA
    ? calcularFaixasProrrogacaoPA({
        tipoPA: processo.tipoPA,
        dataInicioPrazo: processo.dataInicioPrazo,
        dataAssinatura: processo.dataAssinatura,
        prorrogacoes: processo.prorrogacoes,
      }).map((faixa, index) => ({
        ...faixa,
        doc: processo.prorrogacoes?.[index]?.doc || "Documento não informado",
        por: processo.prorrogacoes?.[index]?.por,
        em: processo.prorrogacoes?.[index]?.em,
      }))
    : [];
  const pedido = processo.pedidoSubsidios;
  const respostaDU = processo.respostaDU;
  const situacaoFluxo = pedido?.situacaoFluxo || "";
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

  const rotuloSituacaoFluxo = (situacao?: string) => {
    const mapa: Record<string, string> = {
      aguardando_assinatura_secao: "Aguardando assinatura do chefe da seção",
      aguardando_aprovacao_externa: "Aguardando aprovação externa",
      enviado_admin: "Enviado para chefia",
      MESA_ASSESSOR: "Na mesa do assessor",
      CHEFIA_DILIGENCIA: "Na chefia (diligência)",
      AGUARDANDO_CHEM_DILIGENCIA: "Aguardando assinatura do CHEM (diligência)",
      AGUARDANDO_RESPOSTA: "Aguardando resposta da seção/OM",
      CRIANDO_REITERACAO: "Criando reiteração",
      CHEFIA_DEFESA: "Na chefia (defesa)",
      AGUARDANDO_CHEM_DEFESA: "Aguardando assinatura do CHEM (defesa)",
      APTO_FINALIZAR: "Apto para finalização",
      devolvido_assessor_interno: "Devolvido ao assessor (interno)",
      devolvido_assessor_externo: "Devolvido ao assessor (externo)",
      aprovado_externo_enviado_chem: "Aguardando assinatura do CHEM",
      assinado_externo: "Assinatura externa registrada pelo assessor",
      resposta_assinada_chem: "Resposta assinada pelo CHEM",
    };
    if (!situacao) return "—";
    return mapa[situacao] || situacao;
  };

  const prazoItens = [
    processo.prazo ? { tipo: "interno" as const, label: "Prazo Interno", valor: processo.prazo } : null,
    processo.prazoFatal ? { tipo: "fatal" as const, label: "Prazo Fatal", valor: processo.prazoFatal } : null,
    isDU && processo.pedidoSubsidios?.prazoResposta
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
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              isDU ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {setor}
            </span>
            <span className="text-base font-mono">{processo.numero}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Detalhes completos do processo, partes envolvidas, histórico de movimentações e prazos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Título e Status */}
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{processo.tipoAcao}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {processo.prioridade && (
                <Badge variant={processo.prioridade === "urgente" ? "destructive" : "secondary"}>
                  {processo.prioridade === "urgente" ? "URGENTE" : "Normal"}
                </Badge>
              )}
              {processo.isMS && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Mandado de Segurança
                </Badge>
              )}
              {/* V2.10 — Badge de situação DU sincronizado com o Kanban.
                   V2.20 — Oculta quando o processo já está concluído para
                   evitar exibir "Apto finalizar" em processos finalizados. */}
              {isDU && processo.status !== "concluido" && (
                <Badge variant="outline" className="bg-sky-50 text-sky-800 border-sky-200">
                  {getBadgeSituacaoDU(pedido?.situacaoFluxo)}
                </Badge>
              )}
              {/* V2.10 — Badge de Reiteração (alerta) quando reiteracoes > 0. */}
              {isDU && (pedido?.reiteracoes ?? 0) > 0 && (
                <Badge
                  variant="outline"
                  className="bg-orange-100 text-orange-900 border-orange-300 font-semibold"
                >
                  {pedido?.reiteracoes}ª Reiteração
                </Badge>
              )}
              {!isDU && processo.status && (
                <Badge variant="outline">
                  {processo.status === "concluido" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {processo.status}
                </Badge>
              )}
            </div>
          </div>

          {/* V2.20 — Pedido de Subsídios foi movido para baixo das informações
               principais, atuando como detalhamento secundário. */}

          <Separator />

          {/* Informações Principais — V2.20: 3 colunas para DU
               (Informações Gerais | Documentos | Prazos e Datas). */}
          <div className={`grid grid-cols-1 ${isDU ? "md:grid-cols-3" : "md:grid-cols-2"} gap-6`}>
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informações Gerais</h4>
              
              <InfoRow icon={User} label="Parte / Cliente" value={processo.cliente} />
              
              {isDU && (
                <>
                  <InfoRow icon={Mail} label="Origem" value={processo.origemDU} />
                  <InfoRow icon={Building2} label="Seção" value={processo.secaoDU} />
                </>
              )}
              
              {isPA && (
                <>
                  <InfoRow icon={FileText} label="Tipo PA" value={processo.tipoPA} />
                  <InfoRow icon={User} label="Encarregado" value={processo.encarregado} />
                </>
              )}
              
              <InfoRow icon={User} label="Responsável" value={processo.responsavel} />
            </div>

            {/* V2.20 — Coluna Documentos: enviados (DIEx do pedido) e recebidos
                 (DIEx da resposta), com setinhas indicando o sentido.
                 V2.21 — Edição inline via botão "Editar documentos". */}
            {isDU && (
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
                              processo.pedidoSubsidios?.numeroDocumentoDU ||
                                processo.pedidoSubsidios?.numeroDiex ||
                                "",
                            );
                            setDocRecebidoEdit(
                              processo.respostaDU?.numeroDiex ||
                                processo.respostaDU?.numeroOficio ||
                                "",
                            );
                          }}
                          disabled={savingDocs}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSalvarDocs}
                          disabled={savingDocs}
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          {savingDocs ? "Salvando..." : "Salvar"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditandoDocs(true)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar documentos
                      </Button>
                    )}
                  </div>
                </div>

                {(() => {
                  // V2.22 — Leitura estrita: o ENVIADO só pode vir de
                  // pedidoSubsidios; o RECEBIDO só pode vir de respostaDU.
                  // Sem fallbacks cruzados (que causavam duplicação visual).
                  const docEnviado =
                    pedido?.numeroOficioExterno ||
                    pedido?.numeroDocumentoDU ||
                    pedido?.numeroDiex ||
                    "";
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
                          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                            Enviado
                          </div>
                          {editandoDocs ? (
                            <Input
                              value={docEnviadoEdit}
                              onChange={(e) => setDocEnviadoEdit(e.target.value)}
                              placeholder="Nº DIEx enviado"
                              className="mt-1 h-8 text-sm"
                            />
                          ) : (
                            <div
                              className={`text-sm mt-0.5 ${
                                docEnviado ? "text-slate-800 font-medium" : "text-slate-400 italic"
                              }`}
                            >
                              {docEnviado || "Pendente"}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <ArrowDownLeft className="w-4 h-4 text-sky-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">
                            Recebido
                          </div>
                          {editandoDocs ? (
                            <Input
                              value={docRecebidoEdit}
                              onChange={(e) => setDocRecebidoEdit(e.target.value)}
                              placeholder="Nº DIEx recebido"
                              className="mt-1 h-8 text-sm"
                            />
                          ) : (
                            <div
                              className={`text-sm mt-0.5 ${
                                docRecebido ? "text-slate-800 font-medium" : "text-slate-400 italic"
                              }`}
                            >
                              {docRecebido || "Pendente"}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Prazos e Datas</h4>
                {isDU && (
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
                          <X className="w-3.5 h-3.5 mr-1" />
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSalvarPrazosDU}
                          disabled={savingPrazosDU}
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          {savingPrazosDU ? "Salvando..." : "Salvar"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditandoPrazosDU(true)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar prazos DU
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {processo.dataEntrada && (
                <InfoRow icon={Calendar} label="Data de Entrada" value={formatarData(processo.dataEntrada)} />
              )}

              {isDU && editandoPrazosDU && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                        Prazo Interno
                      </label>
                      <Input
                        type="date"
                        value={prazoInternoEdit}
                        onChange={(e) => setPrazoInternoEdit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                        Prazo Fatal
                      </label>
                      <Input
                        type="date"
                        value={prazoFatalEdit}
                        onChange={(e) => setPrazoFatalEdit(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                        Prazo Subsídios
                      </label>
                      <Input
                        type="date"
                        value={prazoRespostaEdit}
                        onChange={(e) => setPrazoRespostaEdit(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Você pode ajustar todos os prazos finais do DU por aqui.
                  </p>
                </div>
              )}

              {isPA && processo.dataInicioPrazo && (
                <InfoRow icon={Calendar} label="Início do Prazo" value={formatarData(processo.dataInicioPrazo)} />
              )}

              {prazoItens.map((item) => {
                const dias = diasRestantes(item.valor);
                const isFatal = item.tipo === "fatal";
                const icone = isFatal ? (
                  <AlertCircle className={`w-4 h-4 mt-0.5 ${dias <= 5 ? "text-red-500" : "text-orange-500"}`} />
                ) : (
                  <Clock className={`w-4 h-4 mt-0.5 ${item.tipo === "subsidios" ? "text-indigo-500" : "text-blue-500"}`} />
                );

                return (
                  <div key={item.tipo} className="flex items-start gap-3">
                    {icone}
                    <div className="flex-1">
                      <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{item.label}</div>
                      <div className={`text-sm mt-0.5 flex items-center gap-2 ${isFatal ? (dias <= 5 ? "text-red-600 font-bold" : "text-orange-600") : "text-slate-800"}`}>
                        {formatarData(item.valor)}
                        {dias > 0 && (
                          <Badge variant={isFatal && dias <= 5 ? "destructive" : "outline"} className="text-[10px]">
                            {dias} dias restantes
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* V2.20 — Pedido de Subsídios (DU) movido para baixo das informações
               principais, atuando como detalhamento secundário. */}
          {isDU && processo.pedidoSubsidios && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">
                  {(processo.pedidoSubsidios.reiteracoes ?? 0) > 0
                    ? `Pedido de Subsídios (${processo.pedidoSubsidios.reiteracoes}ª Reiteração)`
                    : "Pedido de Subsídios"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <InfoRow icon={FileText} label="Destino" value={processo.pedidoSubsidios.tipoDestino === "interno" ? "Interno" : "Externo"} />
                  <InfoRow icon={Building2} label="Seção/OM" value={processo.pedidoSubsidios.tipoDestino === "interno" ? processo.pedidoSubsidios.secaoInterna : processo.pedidoSubsidios.omExterna} />
                  {/* V2.10 — Mostra o número da cobrança atual (numeroDocumentoDU
                       atualizado pelo motor V2.9), com fallback para o DIEx. */}
                  <InfoRow
                    icon={Mail}
                    label="DIEx / Documento"
                    value={processo.pedidoSubsidios.numeroDocumentoDU || processo.pedidoSubsidios.numeroDiex || "Pendente"}
                  />
                  <InfoRow icon={Calendar} label="Data do Pedido" value={formatarDataHoraSegura(dataPedidoDU)} />
                  {/* V2.10 — Prazo da cobrança atual (dataPrazo), com fallback para
                       o prazoResposta histórico. */}
                  <InfoRow
                    icon={Clock}
                    label="Prazo de Resposta"
                    value={
                      processo.pedidoSubsidios.dataPrazo
                        ? formatarData(processo.pedidoSubsidios.dataPrazo)
                        : processo.pedidoSubsidios.prazoResposta
                          ? formatarData(processo.pedidoSubsidios.prazoResposta)
                          : "—"
                    }
                  />
                  {/* V2.20 — Não exibe situação quando o processo já foi concluído
                       (evita mostrar "Apto finalizar" em processos finalizados). */}
                  {processo.status !== "concluido" && (
                    <InfoRow icon={AlertCircle} label="Situação" value={getBadgeSituacaoDU(processo.pedidoSubsidios.situacaoFluxo)} />
                  )}
                </div>
              </div>
            </>
          )}

          {prorrogacoesPA.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide mb-3">
                  Prorrogações Registradas ({prorrogacoesPA.length})
                </h4>
                <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  {prorrogacoesPA.map((item, index) => (
                    <div
                      key={`${item.doc || "sem-doc"}-${item.em || index}`}
                      className="text-sm text-amber-900 bg-white border border-amber-100 rounded p-3"
                    >
                      <div className="font-semibold">{item.doc || "Documento não informado"}</div>
                      <div className="text-xs text-amber-800 mt-1">
                        Início: {formatarData(item.inicio)} | Fim: {formatarData(item.fim)} | +{item.dias ?? "?"} dias
                        {item.por ? ` | Por: ${item.por}` : ""}
                      </div>
                      {item.em && (
                        <div className="text-[10px] text-amber-700 mt-1">
                          Registro: {formatarData(item.em)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Observações */}
          {processo.observacoes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Observações</h4>
                <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {processo.observacoes}
                </div>
              </div>
            </>
          )}

          {/* Último Movimento */}
          {processo.descricao && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Último Movimento</h4>
                <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <p className="leading-relaxed">{processo.descricao}</p>
                  {(processo.atualizadoPorNome || processo.atualizadoEm) && (
                    <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-200">
                      {processo.atualizadoPorNome && <span>por {processo.atualizadoPorNome.split('@')[0]}</span>}
                      {processo.atualizadoPorNome && processo.atualizadoEm && <span> • </span>}
                      {processo.atualizadoEm && (
                        <span>
                          {formatarDataHoraSegura(processo.atualizadoEm)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Informações de Sistema */}
          <Separator className="my-4" />
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sistema</h4>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              {processo.criadoEm && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">Cadastrado</div>
                  <div className="text-slate-600 font-medium">
                    {formatarDataHoraSegura(processo.criadoEm)}
                  </div>
                  {processo.criadoPorNome && (
                    <div className="text-[10px] text-slate-400">por {processo.criadoPorNome.split('@')[0]}</div>
                  )}
                </div>
              )}
              {processo.atualizadoEm && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">Atualizado</div>
                  <div className="text-slate-600 font-medium">
                    {formatarDataHoraSegura(processo.atualizadoEm)}
                  </div>
                  {processo.atualizadoPorNome && (
                    <div className="text-[10px] text-slate-400">por {processo.atualizadoPorNome.split('@')[0]}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
