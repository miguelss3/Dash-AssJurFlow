import { CalendarIcon, FileSignature, Send } from "lucide-react";
import {
  AcaoPrincipal,
  AssinaturaDestino,
  DOC_DANGER_BTN_CLASS,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  DOC_PRIMARY_BTN_CLASS,
  DOC_SECONDARY_BTN_CLASS,
  LABEL_ACAO,
  LABEL_ASSINATURA_DESTINO,
  docRadioClass,
} from "./shared";

interface MesaChefiaProps {
  assinaturaDestino: AssinaturaDestino;
  acaoPrincipal: AcaoPrincipal;
  numeroDocumentoDU: string;
  setNumeroDocumentoDU: (v: string) => void;
  possuiPrazoDU: boolean;
  setPossuiPrazoDU: (v: boolean) => void;
  dataPrazo: string;
  setDataPrazo: (v: string) => void;
  onAssinarEFinalizar: () => void;
  onAprovarSPED: () => void;
  onDevolverAssessor: () => void;
  onFinalizar: () => void;
}

// Mesa da Chefia — bifurca pela autoridade (Chefe assina; CHEM/Cmt vão p/ SPED).
export function MesaChefia({
  assinaturaDestino,
  acaoPrincipal,
  numeroDocumentoDU,
  setNumeroDocumentoDU,
  possuiPrazoDU,
  setPossuiPrazoDU,
  dataPrazo,
  setDataPrazo,
  onAssinarEFinalizar,
  onAprovarSPED,
  onDevolverAssessor,
  onFinalizar,
}: MesaChefiaProps) {
  const ehAssinaturaChefe = assinaturaDestino === "chefe";
  const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];

  return (
    <div className="space-y-5 animate-in fade-in">
      <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-sm">
        <header className="border-b-2 border-slate-300 pb-3">
          <p className={DOC_LABEL_CLASS}>Signatário (Autoridade)</p>
          <p className="text-base font-bold text-slate-900">{rotuloAutoridade}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Objeto: {LABEL_ACAO[acaoPrincipal]}
          </p>
        </header>

        {ehAssinaturaChefe ? (
          <>
            <section>
              <label className={DOC_LABEL_CLASS}>Nr DIEx Simplificado</label>
              <input
                type="text"
                aria-label="Número do DIEx Simplificado"
                value={numeroDocumentoDU}
                onChange={(e) => setNumeroDocumentoDU(e.target.value)}
                placeholder="Ex: DIEx 045/2026"
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
                      name="possui-prazo-chefia"
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
                  aria-label="Prazo para resposta do DIEx"
                  value={dataPrazo}
                  onChange={(e) => setDataPrazo(e.target.value)}
                  className={DOC_INPUT_CLASS}
                />
              </section>
            )}
          </>
        ) : (
          <p className="text-[12px] text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-md">
            Encaminhe via SPED para assinatura do <strong>{rotuloAutoridade}</strong>. O número do
            documento será informado posteriormente, na vigília do SPED.
          </p>
        )}
      </article>

      {ehAssinaturaChefe ? (
        <button onClick={onAssinarEFinalizar} className={DOC_PRIMARY_BTN_CLASS}>
          <FileSignature className="w-4 h-4" />
          Assinar e {possuiPrazoDU ? "Iniciar Prazo" : "Finalizar"}
        </button>
      ) : (
        <button onClick={onAprovarSPED} className={DOC_PRIMARY_BTN_CLASS}>
          <Send className="w-4 h-4" /> Aprovar via SPED
        </button>
      )}

      <button onClick={onDevolverAssessor} className={DOC_SECONDARY_BTN_CLASS}>
        Devolver ao Assessor
      </button>

      <button onClick={onFinalizar} className={DOC_DANGER_BTN_CLASS}>
        Finalizar Processo
      </button>
    </div>
  );
}
