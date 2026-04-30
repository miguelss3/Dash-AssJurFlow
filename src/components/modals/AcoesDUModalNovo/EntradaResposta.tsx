import { DOC_INPUT_CLASS, DOC_LABEL_CLASS } from "./shared";

interface EntradaRespostaProps {
  numeroRecebido: string;
  setNumeroRecebido: (v: string) => void;
}

// V2.7 — Apenas campo de número. Botão universal "Despachar / Encaminhar"
// no rodapé registra a chegada e devolve ao assessor.
export function EntradaResposta({
  numeroRecebido,
  setNumeroRecebido,
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
    </div>
  );
}
