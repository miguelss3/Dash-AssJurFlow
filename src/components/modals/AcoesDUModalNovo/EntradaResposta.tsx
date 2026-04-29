import { ArrowRightCircle } from "lucide-react";
import {
  DOC_DANGER_BTN_CLASS,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  DOC_PRIMARY_BTN_CLASS,
} from "./shared";

interface EntradaRespostaProps {
  numeroRecebido: string;
  setNumeroRecebido: (v: string) => void;
  onRegistrarEntrada: () => void;
  onFinalizar: () => void;
}

// Entrada de resposta — UI minimalista (V2.1 Tarefa 3): 1 label + 1 input + 1 botão.
export function EntradaResposta({
  numeroRecebido,
  setNumeroRecebido,
  onRegistrarEntrada,
  onFinalizar,
}: EntradaRespostaProps) {
  return (
    <div className="space-y-3 animate-in fade-in">
      <label className={DOC_LABEL_CLASS}>Número do Documento Recebido</label>
      <input
        type="text"
        aria-label="Número do documento recebido"
        value={numeroRecebido}
        onChange={(e) => setNumeroRecebido(e.target.value)}
        placeholder="Ex: Ofício 321/2026"
        className={DOC_INPUT_CLASS}
      />
      <button
        disabled={!numeroRecebido.trim()}
        onClick={onRegistrarEntrada}
        className={DOC_PRIMARY_BTN_CLASS}
      >
        <ArrowRightCircle className="w-4 h-4" /> Registrar Entrada e Devolver ao Assessor
      </button>
      <button onClick={onFinalizar} className={DOC_DANGER_BTN_CLASS}>
        Finalizar Processo
      </button>
    </div>
  );
}
