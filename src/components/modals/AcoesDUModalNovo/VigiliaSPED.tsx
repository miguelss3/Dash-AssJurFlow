import { CalendarIcon, FileSignature, Save } from "lucide-react";
import {
  AssinaturaDestino,
  DOC_DANGER_BTN_CLASS,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  DOC_PRIMARY_BTN_CLASS,
  DOC_SECONDARY_BTN_CLASS,
  LABEL_ASSINATURA_DESTINO,
  docContainerClass,
  docRadioClass,
} from "./shared";
import { CamposDocumento } from "./CamposDocumento";

interface VigiliaSPEDProps {
  assinaturaDestino: AssinaturaDestino;
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
  // V2.5 — Salva os campos no Firestore sem alterar a situacaoFluxo,
  // mantendo o card estacionado em "Aguardando Assinatura".
  onSalvarDados: () => void;
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
  incluiDiexExterno,
  setIncluiDiexExterno,
  incluiOficioExterno,
  setIncluiOficioExterno,
  numeroDiexExterno,
  setNumeroDiexExterno,
  numeroOficioExterno,
  setNumeroOficioExterno,
  onRegistrar,
  onMinutaRejeitada,
  onFinalizar,
}: VigiliaSPEDProps) {
  const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];
  // V2.4 — Para externos, exigimos que ao menos um dos checkboxes esteja
  // marcado e seu respectivo número preenchido. Para chefe, mantém o input
  // simplificado.
  const externoOk =
    assinaturaDestino === "chefe"
      ? numeroDocumentoDU.trim().length > 0
      : (incluiDiexExterno && numeroDiexExterno.trim().length > 0)
        || (incluiOficioExterno && numeroOficioExterno.trim().length > 0);
  const podeRegistrar = externoOk && (!possuiPrazoDU || dataPrazo.trim().length > 0);

  return (
    <div className="space-y-5 animate-in fade-in">
      <article className={docContainerClass(assinaturaDestino)}>
        <header className="border-b-2 border-slate-300 pb-3">
          <p className={DOC_LABEL_CLASS}>Vigília do SPED</p>
          <p className="text-xs text-slate-700">
            Aguardando assinatura do <strong>{rotuloAutoridade}</strong> no SPED.
          </p>
        </header>

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

      {/* V2.5 — Estágio 1 (Aguardando Dados): "Salvar Dados" mantém o card
          estacionado nesta coluna. Estágio 2 (Dados Preenchidos): libera
          "Iniciar Prazo" + "Finalizar Processo". */}
      {!temNumerosRegistrados ? (
        <button onClick={onSalvarDados} className={DOC_SECONDARY_BTN_CLASS}>
          <Save className="w-4 h-4" /> Salvar Dados
        </button>
      ) : (
        <>
          <button
            disabled={!podeIniciarPrazo}
            onClick={onRegistrar}
            className={DOC_PRIMARY_BTN_CLASS}
          >
            <FileSignature className="w-4 h-4" /> Iniciar Prazo
          </button>

          <button onClick={onFinalizar} className={DOC_DANGER_BTN_CLASS}>
            Finalizar Processo
          </button>
        </>
      )}

      {/* Marcha à Ré — minuta rejeitada na assinatura externa. */}
      <button
        onClick={onMinutaRejeitada}
        className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
      >
        Minuta Rejeitada no SPED
      </button>
    </div>
  );
}
