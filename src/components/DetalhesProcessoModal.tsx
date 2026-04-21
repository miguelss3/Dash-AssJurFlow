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
  CheckCircle2
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

  const setor = processo.setor || processo.tipo;
  const isDU = setor === "DU";
  const isPA = setor === "PA";

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
              
              {processo.prazo && (
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Prazo Interno</div>
                    <div className="text-sm text-slate-800 mt-0.5 flex items-center gap-2">
                      {formatarData(processo.prazo)}
                      {diasRestantes(processo.prazo) > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {diasRestantes(processo.prazo)} dias restantes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {processo.prazoFatal && (
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-4 h-4 mt-0.5 ${
                    diasRestantes(processo.prazoFatal) <= 5 ? 'text-red-500' : 'text-orange-500'
                  }`} />
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Prazo Fatal</div>
                    <div className={`text-sm mt-0.5 flex items-center gap-2 ${
                      diasRestantes(processo.prazoFatal) <= 5 ? 'text-red-600 font-bold' : 'text-orange-600'
                    }`}>
                      {formatarData(processo.prazoFatal)}
                      {diasRestantes(processo.prazoFatal) > 0 && (
                        <Badge 
                          variant={diasRestantes(processo.prazoFatal) <= 5 ? "destructive" : "outline"}
                          className="text-[10px]"
                        >
                          {diasRestantes(processo.prazoFatal)} dias restantes
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">Último Movimento</h4>
                <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {processo.descricao}
                </div>
              </div>
            </>
          )}

          {/* Informações de Sistema */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
            {processo.criadoEm && (
              <div>
                <span className="font-semibold">Cadastrado em:</span> {formatarData(processo.criadoEm)}
              </div>
            )}
            {processo.atualizadoEm && (
              <div>
                <span className="font-semibold">Atualizado em:</span> {formatarData(processo.atualizadoEm)}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
