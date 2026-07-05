// Verificação manual: confirma que o mês inicial do "Controle de Prazos"
// (mesAtualLocal, usado em CalendarioPrazos.tsx) sempre corresponde ao mês
// corrente do sistema, independentemente do dia do mês em que é executado.
//
// Rodar com: npx tsx src/lib/prazo.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { format } from "date-fns";
import { mesAtualLocal } from "./prazo.ts";

// Dias do mês representativos: início, meio, fim (incl. mês bissexto e
// virada de ano) — cobre os casos onde um bug de "mês anterior" apareceria.
const DIAS_DE_REFERENCIA = [
  new Date(2026, 0, 1, 0, 5),   // 1º de janeiro, logo após meia-noite
  new Date(2026, 1, 28, 23, 55), // 28 de fevereiro (não bissexto), quase meia-noite
  new Date(2024, 1, 29, 12, 0),  // 29 de fevereiro (ano bissexto)
  new Date(2026, 6, 4, 21, 18),  // hoje (4 de julho de 2026), horário real do bug relatado
  new Date(2026, 11, 31, 23, 59), // 31 de dezembro
];

for (const diaSimulado of DIAS_DE_REFERENCIA) {
  test(`mesAtualLocal() abre no mês corrente quando "hoje" é ${diaSimulado.toDateString()}`, () => {
    const RealDate = Date;
    class DataSimulada extends RealDate {
      constructor(...args) {
        if (args.length === 0) return new RealDate(diaSimulado);
        return new RealDate(...args);
      }
      static now() {
        return diaSimulado.getTime();
      }
    }
    // @ts-expect-error — substituição temporária apenas para o teste
    globalThis.Date = DataSimulada;

    try {
      const mesInicial = mesAtualLocal();
      assert.equal(
        format(mesInicial, "yyyy-MM"),
        format(diaSimulado, "yyyy-MM"),
        `Esperado mês/ano de ${diaSimulado.toDateString()}, mas mesAtualLocal() retornou ${mesInicial}`,
      );
    } finally {
      globalThis.Date = RealDate;
    }
  });
}
