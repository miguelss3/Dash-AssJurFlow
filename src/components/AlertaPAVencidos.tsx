import { AlertTriangle } from "lucide-react";
import type { Processo } from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";
import { nivelUrgenciaPA } from "@/lib/prazo";

interface AlertaPAVencidosProps {
  processos: Processo[];
  siteSettings?: SiteSettings;
  ehAdmin: boolean;
  nomeMilitarAtual: string;
}

function ehConcluido(p: Processo): boolean {
  const statusNorm = String(p.status || "").trim().toLowerCase();
  return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
}

// Avisa sobre processos PA que já passaram da tolerância (ver Ajustes do
// Site → Setor PA) — nunca muda nada no processo, só escala o aviso. A
// chefia vê todo mundo, agrupado por assessor; o próprio assessor PA vê só
// os dele. Não é o mesmo gatilho de "vencido" simples (dia seguinte ao
// prazo) — de propósito, para não gerar alarme antes da folga acabar.
export function AlertaPAVencidos({ processos, siteSettings, ehAdmin, nomeMilitarAtual }: AlertaPAVencidosProps) {
  const criticos = processos.filter((p) => {
    const setor = String(p.setor || p.tipo || "").trim().toUpperCase();
    if (setor !== "PA") return false;
    if (ehConcluido(p)) return false;
    return nivelUrgenciaPA(p.prazoFatal || p.finalPrazo, p.tipoPA, siteSettings) === "vencido_critico";
  });

  if (criticos.length === 0) return null;

  if (ehAdmin) {
    const porAssessor = new Map<string, number>();
    criticos.forEach((p) => {
      const nome = (p.responsavel || "").trim() || "Sem responsável";
      porAssessor.set(nome, (porAssessor.get(nome) || 0) + 1);
    });

    return (
      <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <h4 className="font-bold text-red-900 text-sm">Processos PA além da tolerância</h4>
            <ul className="text-sm text-red-900 space-y-1">
              {Array.from(porAssessor.entries()).map(([nome, qtd]) => (
                <li key={nome}>
                  <b>{nome}</b>: {qtd} processo{qtd === 1 ? "" : "s"} vencido{qtd === 1 ? "" : "s"} além da tolerância.
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const meus = criticos.filter((p) => (p.responsavel || "").trim() === nomeMilitarAtual.trim());
  if (meus.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
      <p className="text-sm text-red-900">
        Você tem <b>{meus.length}</b> processo{meus.length === 1 ? "" : "s"} PA vencido{meus.length === 1 ? "" : "s"} além
        da tolerância. Confira na sua mesa.
      </p>
    </div>
  );
}

export default AlertaPAVencidos;
