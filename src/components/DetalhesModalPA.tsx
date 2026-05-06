import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Processo } from "@/types/processo";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { calcularFaixasProrrogacaoPA, diasRestantes, formatarData } from "@/lib/prazo";
import { getBadgeSituacaoPA } from "@/lib/utils";

interface DetalhesModalPAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
}

export function DetalhesModalPA({ open, onOpenChange, processo }: DetalhesModalPAProps) {
  if (!processo) return null;

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
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Prazos e Datas</h4>
              <InfoRow icon={Calendar} label="Data de Entrada" value={processo.dataEntrada ? formatarData(processo.dataEntrada) : undefined} />
              <InfoRow icon={Calendar} label={emPrazoSolucao ? "Início do Prazo da Solução" : "Início do Prazo"} value={processo.dataInicioPrazo ? formatarData(processo.dataInicioPrazo) : undefined} />
              <InfoRow icon={Clock} label={emPrazoSolucao ? "Prazo da Solução (10 dias)" : "Prazo Fatal"} value={processo.prazoFatal ? formatarData(processo.prazoFatal) : undefined} />
              <InfoRow icon={Clock} label="Prazo Final" value={processo.finalPrazo ? formatarData(processo.finalPrazo) : undefined} />
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
                <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {processo.observacoes}
                </div>
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
