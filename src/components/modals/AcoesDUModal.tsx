import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Send, Reply, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface AcoesDUModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
}

export function AcoesDUModal({ open, onOpenChange, processoId, numeroProcesso }: AcoesDUModalProps) {
  
  const abrirPedidoSubsidios = () => {
    toast.info("Pedido de subsídios em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal de pedido de subsídios
  };

  const abrirRespostaDU = () => {
    toast.info("Resposta DU em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal de resposta DU (Ofício/DIEx)
  };

  const registrarDespachoChem = () => {
    toast.info("Despacho CHEM em desenvolvimento");
    onOpenChange(false);
    // TODO: Abrir modal para registrar despacho do CHEM
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-800">
            Ações DU - {numeroProcesso}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-sky-300 text-sky-700 hover:bg-sky-50"
            onClick={abrirPedidoSubsidios}
          >
            <FileText className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Solicitar Subsídios</div>
              <div className="text-xs text-slate-500">Enviar DIEx pedindo informações</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            onClick={abrirRespostaDU}
          >
            <Send className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Registrar Resposta</div>
              <div className="text-xs text-slate-500">Ofício ou DIEx de resposta</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start h-auto py-4 px-4 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={registrarDespachoChem}
          >
            <CheckCircle className="w-5 h-5 mr-3" />
            <div className="text-left">
              <div className="font-bold">Despacho do CHEM</div>
              <div className="text-xs text-slate-500">Registrar assinatura do chefe</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
