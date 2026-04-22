import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Processo } from "@/types/processo";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  User, 
  FileText, 
  MapPin, 
  Mail, 
  Building2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle
} from "lucide-react";
import { formatarData, diasRestantes } from "@/lib/prazo";
import { Separator } from "@/components/ui/separator";

interface DetalhesProcessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
}

export function DetalhesProcessoModal({ open, onOpenChange, processo }: DetalhesProcessoModalProps) {
  if (!processo) return null;

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

  const setor = processo.setor || processo.tipo;
  const isDU = setor === "DU";
  const isPA = setor === "PA";
  const pedido = processo.pedidoSubsidios;
  const respostaDU = processo.respostaDU;
  const tipoDestino = pedido?.tipoDestino || "interno";
  const situacaoFluxo = pedido?.situacaoFluxo || "";

  const rotuloSituacaoFluxo = (situacao?: string) => {
    const mapa: Record<string, string> = {
      aguardando_assinatura_secao: "Aguardando assinatura do chefe da seção",
      aguardando_aprovacao_externa: "Aguardando aprovação externa",
      enviado_admin: "Enviado para chefia",
      devolvido_assessor_interno: "Devolvido ao assessor (interno)",
      devolvido_assessor_externo: "Devolvido ao assessor (externo)",
      aprovado_externo_enviado_chem: "Aguardando assinatura do CHEM",
      assinado_externo: "Assinatura externa registrada pelo assessor",
      resposta_assinada_chem: "Resposta assinada pelo CHEM",
    };
    if (!situacao) return "—";
    return mapa[situacao] || situacao;
  };

  const timelineDU = (() => {
    if (!isDU || !pedido) return [] as Array<{ id: string; titulo: string; detalhe: string; concluido: boolean; data?: string }>;

    const ordemInterno = ["aguardando_assinatura_secao", "enviado_admin", "devolvido_assessor_interno", "resposta_assinada_chem"];
    const ordemExterno = ["aguardando_aprovacao_externa", "enviado_admin", "aprovado_externo_enviado_chem", "resposta_assinada_chem"];
    const ordemAtual = tipoDestino === "interno" ? ordemInterno : ordemExterno;
    const indiceAtual = ordemAtual.indexOf(situacaoFluxo);

    const eventoConcluido = (codigo: string) => {
      const idx = ordemAtual.indexOf(codigo);
      if (idx < 0) return false;
      if (situacaoFluxo === "resposta_assinada_chem") return true;
      return indiceAtual >= idx;
    };

    const itens: Array<{ id: string; titulo: string; detalhe: string; concluido: boolean; data?: string }> = [
      {
        id: "solicitacao",
        titulo: "Solicitação enviada para chefia",
        detalhe: pedido.tipoSolicitacao === "reiteracao" ? "Reiteração de pedido de subsídios" : "Primeira solicitação de subsídios",
        concluido: !!pedido.solicitadoEm,
        data: pedido.solicitadoEm,
      },
      {
        id: "devolucao",
        titulo: tipoDestino === "interno" ? "Chefia devolveu ao assessor com DIEx" : "Chefia conferiu e enviou ao CHEM",
        detalhe: tipoDestino === "interno" ? "Fluxo interno com DIEx da seção" : "Após conferência, o card volta ao assessor aguardando assinatura do CHEM",
        concluido: eventoConcluido(tipoDestino === "interno" ? "devolvido_assessor_interno" : "aprovado_externo_enviado_chem"),
        data: (pedido as any).devolvidoAoAssessorEm || (pedido as any).assinadoChefiaEm || (pedido as any).aprovadoChefiaEm,
      },
    ];

    if (tipoDestino === "externo") {
      itens.push({
        id: "registro_numeros",
        titulo: "Assinatura do CHEM registrada pelo assessor",
        detalhe: "Assessor preenche Ofício, DIEx ou ambos após assinatura no SPED",
        concluido: eventoConcluido("resposta_assinada_chem") || respostaDU?.situacao === "assinada_chem",
        data: respostaDU?.registradoEm,
      });
    }

    itens.push({
      id: "chem",
      titulo: "Assinatura do CHEM",
      detalhe: "Etapa final do fluxo documental DU",
      concluido: respostaDU?.situacao === "assinada_chem" || eventoConcluido("resposta_assinada_chem"),
      data: respostaDU?.registradoEm,
    });

    return itens;
  })();

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

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) => {
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2 py-1 rounded ${
              isDU ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'
            }`}>
              {setor}
            </span>
            <span className="text-base font-mono">{processo.numero}</span>
          </DialogTitle>
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
              {processo.status && (
                <Badge variant="outline">
                  {processo.status === "concluido" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {processo.status}
                </Badge>
              )}
            </div>
          </div>

          {/* Fluxo de Subsídios (DU) */}
          {isDU && processo.pedidoSubsidios && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Pedido de Subsídios</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <InfoRow icon={FileText} label="Destino" value={processo.pedidoSubsidios.tipoDestino === "interno" ? "Interno" : "Externo"} />
                  <InfoRow icon={Building2} label="Seção/OM" value={processo.pedidoSubsidios.tipoDestino === "interno" ? processo.pedidoSubsidios.secaoInterna : processo.pedidoSubsidios.omExterna} />
                  <InfoRow icon={Mail} label="DIEx" value={processo.pedidoSubsidios.numeroDiex || "Pendente"} />
                  <InfoRow icon={Calendar} label="Data do Pedido" value={formatarDataHoraSegura(processo.pedidoSubsidios.solicitadoEm)} />
                  <InfoRow icon={Clock} label="Prazo de Resposta" value={processo.pedidoSubsidios.prazoResposta ? formatarData(processo.pedidoSubsidios.prazoResposta) : "—"} />
                  <InfoRow icon={AlertCircle} label="Situação" value={rotuloSituacaoFluxo(processo.pedidoSubsidios.situacaoFluxo)} />
                </div>
              </div>
            </>
          )}

          {isDU && timelineDU.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Linha do Tempo Documental DU</h4>
                <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                  {timelineDU.map((evento) => (
                    <div key={evento.id} className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                      {evento.concluido ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                      ) : (
                        <Circle className="mt-0.5 h-4 w-4 text-slate-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-semibold ${evento.concluido ? "text-emerald-700" : "text-slate-700"}`}>{evento.titulo}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{evento.detalhe}</div>
                        {evento.data && <div className="text-[11px] text-slate-400 mt-1">{formatarDataHoraSegura(evento.data)}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Informações Gerais</h4>
              
              <InfoRow icon={User} label="Parte / Cliente" value={processo.cliente} />
              <InfoRow icon={Building2} label="Parte Contrária" value={processo.parteContraria} />
              <InfoRow icon={MapPin} label="Vara / Comarca" value={processo.vara} />
              
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

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Prazos e Datas</h4>
              
              {processo.dataEntrada && (
                <InfoRow icon={Calendar} label="Data de Entrada" value={formatarData(processo.dataEntrada)} />
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
