import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Users, Search, FileSignature, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface AcoesPAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
}

export function AcoesPAModal({ open, onOpenChange, processoId, numeroProcesso }: AcoesPAModalProps) {
  
  const abrirNovaProrrogacao = () => {
    toast.info("Prorrogação em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal de nova prorrogação
  };

  const abrirSubstituicaoEncarregado = () => {
    toast.info("Substituição de encarregado em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal de substituição de encarregado
  };

  const reabrirParaDiligencia = () => {
    toast.info("Diligência em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal para reabrir processo em diligência
  };

  const iniciarPrazo = () => {
    toast.info("Iniciar prazo em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal para iniciar prazo
  };

  const enviarParaAssinatura = () => {
    toast.info("Enviar para assinatura em desenvolvimento");
    onOpenChange(false);
    // TODO: Enviar para assinatura do Comandante
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Ações PA - {numeroProcesso}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={enviarParaAssinatura}
          >
            <FileSignature className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Enviar p/ Assinatura Cmt</div>
              <div className="text-xs text-slate-500">Encaminhar portaria para assinar</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={iniciarPrazo}
          >
            <Clock className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Iniciar Prazo</div>
              <div className="text-xs text-slate-500">Iniciar contagem de prazo</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-violet-300 text-violet-700 hover:bg-violet-50"
            onClick={abrirNovaProrrogacao}
          >
            <Clock className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Nova Prorrogação</div>
              <div className="text-xs text-slate-500">Prorrogar prazo do PA</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-sky-300 text-sky-700 hover:bg-sky-50"
            onClick={abrirSubstituicaoEncarregado}
          >
            <Users className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Substituir Encarregado</div>
              <div className="text-xs text-slate-500">Trocar responsável pelo PA</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={reabrirParaDiligencia}
          >
            <Search className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Reabrir p/ Diligência</div>
              <div className="text-xs text-slate-500">Necessário complementar investigação</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
