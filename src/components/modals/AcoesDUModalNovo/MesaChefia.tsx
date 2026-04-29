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
  docContainerClass,
  docRadioClass,
} from "./shared";
import { CamposDocumento } from "./CamposDocumento";

interface MesaChefiaProps {
  assinaturaDestino: AssinaturaDestino;
  acaoPrincipal: AcaoPrincipal;
  numeroDocumentoDU: string;
  setNumeroDocumentoDU: (v: string) => void;
  possuiPrazoDU: boolean;
  setPossuiPrazoDU: (v: boolean) => void;
  dataPrazo: string;
  setDataPrazo: (v: string) => void;
  // V2.4 — Composição do(s) documento(s).
  incluiDiexExterno: boolean;
  setIncluiDiexExterno: (v: boolean) => void;
  incluiOficioExterno: boolean;
  setIncluiOficioExterno: (v: boolean) => void;
  numeroDiexExterno: string;
  setNumeroDiexExterno: (v: string) => void;
  numeroOficioExterno: string;
  setNumeroOficioExterno: (v: string) => void;
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
  incluiDiexExterno,
  setIncluiDiexExterno,
  incluiOficioExterno,
  setIncluiOficioExterno,
  numeroDiexExterno,
  setNumeroDiexExterno,
  numeroOficioExterno,
  setNumeroOficioExterno,
  onAssinarEFinalizar,
  onAprovarSPED,
  onDevolverAssessor,
  onFinalizar,
}: MesaChefiaProps) {
  const ehAssinaturaChefe = assinaturaDestino === "chefe";
  const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];

  return (
    <div className="space-y-5 animate-in fade-in">
      <article className={docContainerClass(assinaturaDestino)}>
        <header className="border-b-2 border-slate-300 pb-3">
          <p className={DOC_LABEL_CLASS}>Signatário (Autoridade)</p>
          <p className="text-base font-bold text-slate-900">{rotuloAutoridade}</p>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Objeto: {LABEL_ACAO[acaoPrincipal]}
          </p>
        </header>

        {ehAssinaturaChefe ? (
          <>
            <CamposDocumento
              assinaturaDestino={assinaturaDestino}
              numeroDocumentoDU={numeroDocumentoDU}
              setNumeroDocumentoDU={setNumeroDocumentoDU}
              incluiDiexExterno={incluiDiexExterno}
              setIncluiDiexExterno={setIncluiDiexExterno}
              incluiOficioExterno={incluiOficioExterno}
              setIncluiOficioExterno={setIncluiOficioExterno}
              numeroDiexExterno={numeroDiexExterno}
              setNumeroDiexExterno={setNumeroDiexExterno}
              numeroOficioExterno={numeroOficioExterno}
              setNumeroOficioExterno={setNumeroOficioExterno}
            />

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
          <>
            <CamposDocumento
              assinaturaDestino={assinaturaDestino}
              numeroDocumentoDU={numeroDocumentoDU}
              setNumeroDocumentoDU={setNumeroDocumentoDU}
              incluiDiexExterno={incluiDiexExterno}
              setIncluiDiexExterno={setIncluiDiexExterno}
              incluiOficioExterno={incluiOficioExterno}
              setIncluiOficioExterno={setIncluiOficioExterno}
              numeroDiexExterno={numeroDiexExterno}
              setNumeroDiexExterno={setNumeroDiexExterno}
              numeroOficioExterno={numeroOficioExterno}
              setNumeroOficioExterno={setNumeroOficioExterno}
              opcional
            />
            <p className="text-[12px] text-slate-700 bg-white/60 border border-emerald-200 p-3 rounded-md">
              Encaminhe via SPED para assinatura do <strong>{rotuloAutoridade}</strong>. Os números
              definitivos podem ser confirmados na vigília do SPED.
            </p>
          </>
        )}
      </article>

      {ehAssinaturaChefe ? (
        <button onClick={onAssinarEFinalizar} className={DOC_PRIMARY_BTN_CLASS}>
          <FileSignature className="w-4 h-4" />
          {/* V2.6 — Documento interno: estritamente "Assinar". */}
          Assinar
        </button>
      ) : (
        <button onClick={onAprovarSPED} className={DOC_PRIMARY_BTN_CLASS}>
          {/* V2.6 — Documento externo: estritamente "Aprovado" (manda para Vigília SPED). */}
          <Send className="w-4 h-4" /> Aprovado
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
