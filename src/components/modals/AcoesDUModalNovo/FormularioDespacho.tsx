import { CalendarIcon, Send } from "lucide-react";
import {
  AcaoPrincipal,
  AssinaturaDestino,
  DOC_DANGER_BTN_CLASS,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  DOC_PRIMARY_BTN_CLASS,
  LABEL_ACAO,
  LABEL_ASSINATURA_DESTINO,
  docRadioClass,
} from "./shared";

interface FormularioDespachoProps {
  acaoPrincipal: AcaoPrincipal;
  setAcaoPrincipal: (v: AcaoPrincipal) => void;
  assinaturaDestino: AssinaturaDestino;
  setAssinaturaDestino: (v: AssinaturaDestino) => void;
  dataPrazo: string;
  setDataPrazo: (v: string) => void;
  isReiteracao: boolean;
  setIsReiteracao: (v: boolean) => void;
  onEnviarChefia: () => void;
  onFinalizar: () => void;
}

// Formulário universal "Despacho" — Signatário → Objeto → Prazo → Botão.
export function FormularioDespacho({
  acaoPrincipal,
  setAcaoPrincipal,
  assinaturaDestino,
  setAssinaturaDestino,
  dataPrazo,
  setDataPrazo,
  isReiteracao,
  setIsReiteracao,
  onEnviarChefia,
  onFinalizar,
}: FormularioDespachoProps) {
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
      <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-sm">
        {/* Signatário */}
        <header className="border-b-2 border-slate-300 pb-3">
          <p className={DOC_LABEL_CLASS}>Signatário (Autoridade)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(["chefe", "chem", "cmt"] as AssinaturaDestino[]).map((opt) => (
              <label key={opt} className={docRadioClass(assinaturaDestino === opt)}>
                <input
                  type="radio"
                  name="assinatura-destino-du"
                  aria-label={LABEL_ASSINATURA_DESTINO[opt]}
                  checked={assinaturaDestino === opt}
                  onChange={() => setAssinaturaDestino(opt)}
                  className="hidden"
                />
                {LABEL_ASSINATURA_DESTINO[opt]}
              </label>
            ))}
          </div>
        </header>

        {/* Objeto */}
        <section>
          <p className={DOC_LABEL_CLASS}>Objeto do Despacho</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(LABEL_ACAO) as AcaoPrincipal[]).map((opt) => (
              <label key={opt} className={docRadioClass(acaoPrincipal === opt)}>
                <input
                  type="radio"
                  name="acao-principal-du"
                  aria-label={LABEL_ACAO[opt]}
                  checked={acaoPrincipal === opt}
                  onChange={() => {
                    setAcaoPrincipal(opt);
                    if (opt === "DEFESA") setDataPrazo("");
                  }}
                  className="hidden"
                />
                {LABEL_ACAO[opt]}
              </label>
            ))}
          </div>

          {/* Reiteração — exibido apenas para DILIGENCIA. */}
          {acaoPrincipal === "DILIGENCIA" && (
            <label className="mt-3 flex items-center gap-2 text-[12px] text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                aria-label="Este despacho é uma Reiteração"
                checked={isReiteracao}
                onChange={(e) => setIsReiteracao(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#0F172A]"
              />
              Este despacho é uma <strong>Reiteração</strong>.
            </label>
          )}
        </section>

        {/* Prazo (apenas em DILIGENCIA) */}
        {acaoPrincipal === "DILIGENCIA" && (
          <section>
            <label className={`${DOC_LABEL_CLASS} flex items-center gap-1`}>
              <CalendarIcon className="w-3 h-3" /> Prazo para Resposta
            </label>
            <input
              type="date"
              aria-label="Prazo para resposta"
              value={dataPrazo}
              onChange={(e) => setDataPrazo(e.target.value)}
              className={DOC_INPUT_CLASS}
            />
          </section>
        )}
      </article>

      <button onClick={onEnviarChefia} className={DOC_PRIMARY_BTN_CLASS}>
        <Send className="w-4 h-4" /> Enviar para Chefia
      </button>

      <button onClick={onFinalizar} className={DOC_DANGER_BTN_CLASS}>
        Finalizar Processo
      </button>
    </div>
  );
}
