import { CalendarIcon } from "lucide-react";
import {
  AssinaturaDestino,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
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
  incluiDiexExterno: boolean;
  setIncluiDiexExterno: (v: boolean) => void;
  incluiOficioExterno: boolean;
  setIncluiOficioExterno: (v: boolean) => void;
  numeroDiexExterno: string;
  setNumeroDiexExterno: (v: string) => void;
  numeroOficioExterno: string;
  setNumeroOficioExterno: (v: string) => void;
}

// V2.7 — Vigília do SPED: apenas formulário. O botão universal "Despachar /
// Encaminhar" no rodapé executa diretamente o registro (com prazo → AGUARDANDO
// _RESPOSTA, sem prazo → MESA_ASSESSOR), eliminando os 2 estágios anteriores.
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
}: VigiliaSPEDProps) {
  const rotuloAutoridade = LABEL_ASSINATURA_DESTINO[assinaturaDestino];

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
    </div>
  );
}
