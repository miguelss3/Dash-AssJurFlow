import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/prazo";

export interface ItemFeriasPendente {
  nomeMilitar: string;
  dataRetorno: string;
  quantidade: number;
}

interface AlertaFeriasPendentesProps {
  itens: ItemFeriasPendente[];
  onIrParaFerias: () => void;
}

// Avisa a chefia, logo na tela principal, quando alguém de férias ainda tem
// processos ativos não redistribuídos — pra não depender só de lembrar de
// abrir o Plano de Férias.
export function AlertaFeriasPendentes({ itens, onIrParaFerias }: AlertaFeriasPendentesProps) {
  if (itens.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
          <h4 className="font-bold text-amber-900 text-sm">Redistribuição necessária</h4>
          <ul className="text-sm text-amber-900 space-y-1">
            {itens.map((item) => (
              <li key={item.nomeMilitar}>
                <b>{item.nomeMilitar}</b> está de férias (até {formatarData(item.dataRetorno)}) e ainda tem{" "}
                <b>{item.quantidade}</b> processo{item.quantidade === 1 ? "" : "s"} na caixa sem redistribuir.
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={onIrParaFerias} className="border-amber-400 text-amber-900 hover:bg-amber-100">
            Ir para o Plano de Férias
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AlertaFeriasPendentes;
