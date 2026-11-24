import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Processo } from "@/types/processo";
import type { SiteSettings } from "@/types/siteSettings";
import { nivelUrgenciaPA, nivelUrgenciaDU } from "@/lib/prazo";

type SetorAlerta = "DU" | "PA";

interface AlertaProcessosVencidosProps {
  setor: SetorAlerta;
  processos: Processo[];
  siteSettings?: SiteSettings;
  ehAdmin: boolean;
  nomeMilitarAtual: string;
}

function ehConcluido(p: Processo): boolean {
  const statusNorm = String(p.status || "").trim().toLowerCase();
  return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
}

// DU em âmbar, PA em vermelho — cores diferentes de propósito, para dar pra
// distinguir os dois avisos de relance sem precisar ler o texto.
const TEMA: Record<SetorAlerta, { border: string; bg: string; text: string; icon: string; btn: string }> = {
  PA: {
    border: "border-red-400",
    bg: "bg-red-50",
    text: "text-red-900",
    icon: "text-red-600",
    btn: "border-red-400 text-red-900 hover:bg-red-100",
  },
  DU: {
    border: "border-amber-400",
    bg: "bg-amber-50",
    text: "text-amber-900",
    icon: "text-amber-600",
    btn: "border-amber-400 text-amber-900 hover:bg-amber-100",
  },
};

function chaveDismiss(setor: SetorAlerta): string {
  return `assjur:aviso:vencidoCritico:${setor}`;
}

function lerDismissInicial(setor: SetorAlerta): boolean {
  try {
    return window.sessionStorage.getItem(chaveDismiss(setor)) === "1";
  } catch {
    return false;
  }
}

function ehCritico(p: Processo, setor: SetorAlerta, siteSettings?: SiteSettings): boolean {
  const setorProcesso = String(p.setor || p.tipo || "").trim().toUpperCase();
  if (setorProcesso !== setor) return false;
  if (ehConcluido(p)) return false;

  const prazo = p.prazoFatal || p.finalPrazo;
  if (setor === "PA") {
    return nivelUrgenciaPA(prazo, p.tipoPA, siteSettings) === "vencido_critico";
  }
  return nivelUrgenciaDU(prazo, siteSettings) === "vencido_critico";
}

// Avisa sobre processos (DU ou PA) que já passaram da tolerância — nunca
// muda nada no processo, só escala o aviso.
//
// Para a chefia: é só para ciência. Aparece a partir do login e some ao
// clicar em "Estou ciente" — a partir daí fica escondido pelo resto da
// sessão (sessionStorage), mesmo que surjam novos críticos; só volta a
// aparecer em um novo login (ver logout() em useAuth.ts, que limpa essa
// marca).
//
// Para o próprio assessor do setor: fica fixo, sem botão de dispensar, até
// o problema ser de fato resolvido (deixar de haver crítico dele).
export function AlertaProcessosVencidos({ setor, processos, siteSettings, ehAdmin, nomeMilitarAtual }: AlertaProcessosVencidosProps) {
  const tema = TEMA[setor];
  const [ciente, setCiente] = useState(() => lerDismissInicial(setor));

  const criticos = processos.filter((p) => ehCritico(p, setor, siteSettings));
  if (criticos.length === 0) return null;

  if (ehAdmin) {
    if (ciente) return null;

    const porAssessor = new Map<string, number>();
    criticos.forEach((p) => {
      const nome = (p.responsavel || "").trim() || "Sem responsável";
      porAssessor.set(nome, (porAssessor.get(nome) || 0) + 1);
    });

    const darCiencia = () => {
      try {
        window.sessionStorage.setItem(chaveDismiss(setor), "1");
      } catch {
        /* sem sessionStorage disponível — o aviso só não persiste entre telas */
      }
      setCiente(true);
    };

    return (
      <div className={`rounded-2xl border-2 ${tema.border} ${tema.bg} p-4`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`h-5 w-5 ${tema.icon} mt-0.5 shrink-0`} />
          <div className="flex-1 space-y-2">
            <h4 className={`font-bold ${tema.text} text-sm`}>Processos {setor} além da tolerância</h4>
            <ul className={`text-sm ${tema.text} space-y-1`}>
              {Array.from(porAssessor.entries()).map(([nome, qtd]) => (
                <li key={nome}>
                  <b>{nome}</b>: {qtd} processo{qtd === 1 ? "" : "s"} vencido{qtd === 1 ? "" : "s"} além da tolerância.
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={darCiencia} className={tema.btn}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Estou ciente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const meus = criticos.filter((p) => (p.responsavel || "").trim() === nomeMilitarAtual.trim());
  if (meus.length === 0) return null;

  return (
    <div className={`rounded-2xl border-2 ${tema.border} ${tema.bg} p-4 flex items-center gap-3`}>
      <AlertTriangle className={`h-5 w-5 ${tema.icon} shrink-0`} />
      <p className={`text-sm ${tema.text}`}>
        Você tem <b>{meus.length}</b> processo{meus.length === 1 ? "" : "s"} {setor} vencido{meus.length === 1 ? "" : "s"} além
        da tolerância. Confira na sua mesa.
      </p>
    </div>
  );
}

export default AlertaProcessosVencidos;
