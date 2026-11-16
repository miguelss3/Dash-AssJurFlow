import { useAuth, isAdmin, isAdminUniversal } from "./useAuth";
import { useComandoAssJur } from "./useComandoAssJur";

function dataCivilAtual(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// V4.3 — Comando da AssJur: hook compartilhado para qualquer componente que
// chame `isAdmin`/`isAdminUniversal` por conta própria (via seu próprio
// useAuth()) e precise reconhecer quem está agindo com o comando delegado —
// sem isso, cada tela que fizesse essa checagem isoladamente ficaria "cega"
// para a delegação (foi o caso de Gestão da Equipe, Ajustes do Site e dos
// modais de cadastro/ações). `ehObservador` é quem DELEGOU e está mantendo
// a visão ampla sem poder escrever (ver firestore.rules para o bloqueio real).
export function useComandoEfetivo() {
  const { user } = useAuth();
  const { comando } = useComandoAssJur();

  const hoje = dataCivilAtual();
  const comandoVigente = !!comando && hoje >= comando.dataInicio && hoje < comando.dataFim;
  const souDelegadoAtivo = comandoVigente && comando?.delegadoUid === user?.uid;
  const ehObservador = comandoVigente && comando?.delegadorUid === user?.uid;

  return {
    ehAdminEfetivo: isAdmin(user) || souDelegadoAtivo,
    ehAdminUniversalEfetivo: isAdminUniversal(user) || souDelegadoAtivo,
    souDelegadoAtivo,
    ehObservador,
    comando,
  };
}
