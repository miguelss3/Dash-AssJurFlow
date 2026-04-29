import { CalendarIcon, FileSignature } from "lucide-react";
import {
  AssinaturaDestino,
  DOC_DANGER_BTN_CLASS,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  DOC_PRIMARY_BTN_CLASS,
  LABEL_ASSINATURA_DESTINO,
  docRadioClass,
} from "./shared";

interface VigiliaSPEDProps {
  assinaturaDestino: AssinaturaDestino;
  numeroDocumentoDU: string;
  setNumeroDocumentoDU: (v: string) => void;
  possuiPrazoDU: boolean;
  setPossuiPrazoDU: (v: boolean) => void;
  dataPrazo: string;
  setDataPrazo: (v: string) => void;
  onRegistrar: () => void;
  onMinutaRejeitada: () => void;
  onFinalizar: () => void;
}

// Vigília do SPED — registra o nº do documento após assinatura externa.
export function VigiliaSPED({
  assinaturaDestino,
  numeroDocumentoDU,
  setNumeroDocumentoDU,
  possuiPrazoDU,
  setPossuiPrazoDU,
  dataPrazo,
  setDataPrazo,
  onRegistrar,
  onMinutaRejeitada,
  onFinalizar,
}: VigiliaSPEDProps) {
  const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];
  const podeRegistrar =
    numeroDocumentoDU.trim().length > 0 && (!possuiPrazoDU || dataPrazo.trim().length > 0);

  return (
    <div className="space-y-5 animate-in fade-in">
      <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-sm">
        <header className="border-b-2 border-slate-300 pb-3">
          <p className={DOC_LABEL_CLASS}>Vigília do SPED</p>
          <p className="text-xs text-slate-700">
            Aguardando assinatura do <strong>{rotuloAutoridade}</strong> no SPED.
          </p>
        </header>

        <section>
          <label className={DOC_LABEL_CLASS}>Número do Documento Gerado</label>
          <input
            type="text"
            aria-label="Número do documento gerado no SPED"
            value={numeroDocumentoDU}
            onChange={(e) => setNumeroDocumentoDU(e.target.value)}
            placeholder="Ex: Ofício nº 123/2026"
            className={DOC_INPUT_CLASS}
          />
        </section>

        <section>
          <p className={DOC_LABEL_CLASS}>Existe Prazo para Resposta?</p>
          <div className="grid grid-cols-2 gap-2">
            {[true, false].map((v) => (
              <label key={String(v)} className={docRadioClass(possuiPrazoDU === v)}>
                <input
                  type="radio"
                  name="possui-prazo-du"
                  aria-label={v ? "Sim" : "Não"}
                  checked={possuiPrazoDU === v}
                  onChange={() => setPossuiPrazoDU(v)}
                  className="hidden"
                />
                {v ? "Sim" : "Não"}
              </label>
            ))}
          </div>
        </section>

        {possuiPrazoDU && (
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

      <button
        disabled={!podeRegistrar}
        onClick={onRegistrar}
        className={DOC_PRIMARY_BTN_CLASS}
      >
        <FileSignature className="w-4 h-4" /> Registrar Documento
      </button>

      {/* Marcha à Ré — minuta rejeitada na assinatura externa. */}
      <button
        onClick={onMinutaRejeitada}
        className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
      >
        Minuta Rejeitada no SPED
      </button>

      <button onClick={onFinalizar} className={DOC_DANGER_BTN_CLASS}>
        Finalizar Processo
      </button>
    </div>
  );
}
