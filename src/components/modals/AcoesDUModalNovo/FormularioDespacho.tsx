import { CalendarIcon } from "lucide-react";
import {
  AcaoPrincipal,
  AssinaturaDestino,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  LABEL_ACAO,
  LABEL_ASSINATURA_DESTINO,
  docContainerClass,
  docRadioClass,
} from "./shared";
import { CamposDocumento } from "./CamposDocumento";
import { formatarData } from "@/lib/prazo";

interface FormularioDespachoProps {
  acaoPrincipal: AcaoPrincipal;
  setAcaoPrincipal: (v: AcaoPrincipal) => void;
  assinaturaDestino: AssinaturaDestino;
  setAssinaturaDestino: (v: AssinaturaDestino) => void;
  dataPrazo: string;
  setDataPrazo: (v: string) => void;
  isReiteracao: boolean;
  setIsReiteracao: (v: boolean) => void;
  numeroDocumentoDU: string;
  setNumeroDocumentoDU: (v: string) => void;
  incluiDiexExterno: boolean;
  setIncluiDiexExterno: (v: boolean) => void;
  incluiOficioExterno: boolean;
  setIncluiOficioExterno: (v: boolean) => void;
  numeroDiexExterno: string;
  setNumeroDiexExterno: (v: string) => void;
  numeroOficioExterno: string;
  setNumeroOficioExterno: (v: string) => void;
  // V2.8 — Memória do despacho anterior para o banner de Reiteração.
  numeroAnterior?: string;
  prazoAnterior?: string;
}

// V2.7 — Apenas campos de formulário. Ações primárias (Despachar) e secundárias
// (Finalizar) vivem no rodapé universal do orquestrador AcoesDUModalNovo.
export function FormularioDespacho({
  acaoPrincipal,
  setAcaoPrincipal,
  assinaturaDestino,
  setAssinaturaDestino,
  dataPrazo,
  setDataPrazo,
  isReiteracao,
  setIsReiteracao,
  numeroDocumentoDU,
  setNumeroDocumentoDU,
  incluiDiexExterno,
  setIncluiDiexExterno,
  incluiOficioExterno,
  setIncluiOficioExterno,
  numeroDiexExterno,
  setNumeroDiexExterno,
  numeroOficioExterno,
  setNumeroOficioExterno,
  numeroAnterior,
  prazoAnterior,
}: FormularioDespachoProps) {
  // V2.8 — Banner só aparece quando o assessor confirmar a reiteração e
  // existir, no documento, registro do despacho anterior.
  const exibirBannerReiteracao =
    isReiteracao
    && acaoPrincipal === "DILIGENCIA"
    && Boolean(numeroAnterior && numeroAnterior.trim());

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
      <article className={docContainerClass(assinaturaDestino)}>
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

          {/* V2.8 — Banner inteligente de memória da cobrança anterior. */}
          {exibirBannerReiteracao && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-800">
              <p className="font-bold flex items-center gap-1 mb-1">
                ⚠️ Histórico da Cobrança:
              </p>
              <p>
                Estamos reiterando o documento <strong>{numeroAnterior}</strong>.
              </p>
              {prazoAnterior && prazoAnterior.trim() && (
                <p>
                  O prazo original havia sido fixado para{" "}
                  <strong>{formatarData(prazoAnterior)}</strong> e não foi cumprido.
                </p>
              )}
            </div>
          )}
        </section>

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
    </div>
  );
}
