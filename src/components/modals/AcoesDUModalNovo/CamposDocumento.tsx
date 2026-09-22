import {
  AssinaturaDestino,
  DOC_INPUT_CLASS,
  DOC_LABEL_CLASS,
  docCheckboxPillClass,
} from "./shared";

interface CamposDocumentoProps {
  assinaturaDestino: AssinaturaDestino;
  // Número genérico (DIEx Simplificado quando interno; mantém compat. com o
  // input legado quando externo sem checkbox marcado).
  numeroDocumentoDU: string;
  setNumeroDocumentoDU: (v: string) => void;
  // V2.4 — Múltiplos documentos externos.
  incluiDiexExterno: boolean;
  setIncluiDiexExterno: (v: boolean) => void;
  incluiOficioExterno: boolean;
  setIncluiOficioExterno: (v: boolean) => void;
  numeroDiexExterno: string;
  setNumeroDiexExterno: (v: string) => void;
  numeroOficioExterno: string;
  setNumeroOficioExterno: (v: string) => void;
  // Quando true, deixa preenchimento opcional (ex.: assessor antecipando os
  // tipos antes da assinatura). Quando false, é obrigatório (Chefia / SPED).
  opcional?: boolean;
  // V3.10 — Quando true, esconde os campos de número (DIEx/Ofício externo):
  // na mesa do assessor só o tipo é escolhido, o número quem preenche é
  // quem assina (CHEM/Cmt), já na Vigília do SPED.
  ocultarNumeros?: boolean;
}

// V2.4 — Bloco unificado de "Montagem de Documento(s)" reutilizável nas três
// visões (Assessor, Chefia, Vigília SPED). Para "chefe" exibe apenas 1 input;
// para "chem"/"cmt" exibe checkboxes (DIEx + Ofício) com inputs condicionais.
export function CamposDocumento({
  assinaturaDestino,
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
  opcional = false,
  ocultarNumeros = false,
}: CamposDocumentoProps) {
  if (assinaturaDestino === "chefe") {
    return (
      <section>
        <label className={DOC_LABEL_CLASS}>
          Nr DIEx Simplificado {opcional && <span className="text-slate-500">(opcional)</span>}
        </label>
        <input
          type="text"
          aria-label="Número do DIEx Simplificado"
          value={numeroDocumentoDU}
          onChange={(e) => setNumeroDocumentoDU(e.target.value)}
          placeholder="Ex: DIEx 045/2026"
          className={DOC_INPUT_CLASS}
        />
      </section>
    );
  }

  // Externo (CHEM / Cmt).
  // V3.8 — Fora do modo duplo (os dois de fato saindo juntos), o seletor
  // mostra só o tipo escolhido: o outro pill some em vez de ficar exposto
  // sem função. "+ Também enviar X" é o único jeito de entrar no modo duplo.
  const ambosSelecionados = incluiDiexExterno && incluiOficioExterno;
  const exibirPillDiex = !incluiOficioExterno || ambosSelecionados;
  const exibirPillOficio = !incluiDiexExterno || ambosSelecionados;
  const totalPillsVisiveis = (exibirPillDiex ? 1 : 0) + (exibirPillOficio ? 1 : 0);

  return (
    <section className="space-y-4">
      <div>
        <p className={DOC_LABEL_CLASS}>
          Tipo(s) de Documento Externo {opcional && <span className="text-slate-500">(opcional)</span>}
        </p>
        <div className={totalPillsVisiveis === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
          {exibirPillDiex && (
            <label className={docCheckboxPillClass(incluiDiexExterno)}>
              <input
                type="checkbox"
                aria-label="Incluir DIEx"
                checked={incluiDiexExterno}
                onChange={(e) => {
                  // Fora do modo duplo, marcar um tipo desmarca o outro — a
                  // única forma de ter os dois juntos é o link abaixo.
                  setIncluiDiexExterno(e.target.checked);
                  if (e.target.checked && !ambosSelecionados) setIncluiOficioExterno(false);
                }}
                className="hidden"
              />
              DIEx
            </label>
          )}
          {exibirPillOficio && (
            <label className={docCheckboxPillClass(incluiOficioExterno)}>
              <input
                type="checkbox"
                aria-label="Incluir Ofício"
                checked={incluiOficioExterno}
                onChange={(e) => {
                  setIncluiOficioExterno(e.target.checked);
                  if (e.target.checked && !ambosSelecionados) setIncluiDiexExterno(false);
                }}
                className="hidden"
              />
              Ofício
            </label>
          )}
        </div>

        {!ambosSelecionados && (incluiDiexExterno || incluiOficioExterno) && (
          <button
            type="button"
            onClick={() => {
              setIncluiDiexExterno(true);
              setIncluiOficioExterno(true);
            }}
            className="mt-2 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
          >
            + Também enviar {incluiDiexExterno ? "Ofício" : "DIEx"} (documento duplo)
          </button>
        )}
      </div>

      {!ocultarNumeros && incluiDiexExterno && (
        <div>
          <label className={DOC_LABEL_CLASS}>Número do DIEx Externo</label>
          <input
            type="text"
            aria-label="Número do DIEx Externo"
            value={numeroDiexExterno}
            onChange={(e) => setNumeroDiexExterno(e.target.value)}
            placeholder="Ex: DIEx nº 123/2026"
            className={DOC_INPUT_CLASS}
          />
        </div>
      )}

      {!ocultarNumeros && incluiOficioExterno && (
        <div>
          <label className={DOC_LABEL_CLASS}>Número do Ofício</label>
          <input
            type="text"
            aria-label="Número do Ofício"
            value={numeroOficioExterno}
            onChange={(e) => setNumeroOficioExterno(e.target.value)}
            placeholder="Ex: Ofício nº 456/2026"
            className={DOC_INPUT_CLASS}
          />
        </div>
      )}
    </section>
  );
}
