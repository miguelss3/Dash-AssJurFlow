import { Crown, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatarData } from "@/lib/prazo";

interface ComandoAssJurBannerProps {
  souObservador: boolean;
  souDelegado: boolean;
  delegadoNome?: string;
  delegadorNome?: string;
  dataFim?: string;
  onRevogar: () => void;
  revogando?: boolean;
}

// Visível em qualquer aba (não só no Dashboard) — quem delegou o comando
// precisa ver isto o tempo todo, já que continua circulando pelo sistema
// inteiro em modo observador.
export function ComandoAssJurBanner({
  souObservador,
  souDelegado,
  delegadoNome,
  delegadorNome,
  dataFim,
  onRevogar,
  revogando,
}: ComandoAssJurBannerProps) {
  if (!souObservador && !souDelegado) return null;

  if (souObservador) {
    return (
      <div className="rounded-2xl border-2 border-sky-400 bg-sky-50 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <Eye className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sky-900 text-sm">Modo Observador</p>
            <p className="text-sm text-sky-900">
              O comando está delegado para <b>{delegadoNome}</b> até {dataFim ? formatarData(dataFim) : "—"}. Você
              continua vendo tudo, mas não pode alterar nada enquanto isso.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onRevogar} disabled={revogando} className="border-sky-400 text-sky-900 hover:bg-sky-100 shrink-0">
          <Lock className="h-3.5 w-3.5 mr-1.5" />
          {revogando ? "Revogando..." : "Revogar e retomar o comando"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 flex items-center gap-3">
      <Crown className="h-5 w-5 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-900">
        Você está no comando interino da AssJur (em nome de <b>{delegadorNome}</b>) até{" "}
        {dataFim ? formatarData(dataFim) : "—"}.
      </p>
    </div>
  );
}

export default ComandoAssJurBanner;
