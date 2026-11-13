import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { Plane, Lock, ArrowRightLeft, Trash2, Users as UsersIcon } from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { Processo } from "@/types/processo";
import type { FeriasMilitar } from "@/hooks/useFeriasMilitares";
import { nomeMilitarUsuario, normalizarSetorUsuario } from "@/lib/userProfiles";
import { formatarData, statusPrazo } from "@/lib/prazo";

interface UsuarioLista {
  id: string;
  uid?: string;
  posto?: string;
  nome?: string;
  nomeGuerra?: string;
  email?: string;
  setor?: string;
  ativo?: boolean;
}

interface UsuarioLogado {
  uid?: string;
  posto?: string;
  nome?: string;
  nomeGuerra?: string;
  role?: string;
  setor?: string;
  cargo?: string;
  email?: string;
}

interface FeriasMilitaresProps {
  usuario?: UsuarioLogado | null;
  ehAdmin: boolean;
  processos: Processo[];
  ferias: FeriasMilitar[];
  onCriarFerias: (
    dados: Omit<FeriasMilitar, "id" | "criadoEm" | "atualizadoEm" | "processosRedistribuidos" | "processosRevertidos">,
  ) => Promise<void>;
  onExcluirFerias: (id: string) => Promise<void>;
  onRedistribuirFerias: (
    id: string,
    substitutoUid: string,
    substitutoNome: string,
    processoIds: string[],
  ) => Promise<void>;
  onRedistribuirProcesso: (
    processoId: string,
    novoResponsavel: string,
    opcoes?: { mensagemHistorico?: string },
  ) => Promise<void>;
}

// Mesmo critério de conclusão usado no resto do app (ver SidebarAssessoresResumo).
function ehConcluido(p: Processo): boolean {
  const statusNorm = String(p.status || "").trim().toLowerCase();
  return p.finalizado === true || statusNorm === "concluido" || statusNorm === "concluído";
}

function prazoReferencia(p: Processo): string | undefined {
  return p.prazoFatal || p.finalPrazo || p.prazo;
}

function dataCivilAtual(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type StatusFerias = "agendada" | "ativa" | "concluida";

// Convenção: dataRetorno é o 1º dia de volta ao trabalho — a ausência cobre
// [dataInicio, dataRetorno). Mantém coerência com o robô de reversão
// automática em routes/index.tsx (que só devolve processos quando
// hoje >= dataRetorno) e com o bloqueio de caixa no handleRedistribuir.
function statusDaFerias(f: FeriasMilitar, hoje: string): StatusFerias {
  if (hoje < f.dataInicio) return "agendada";
  if (hoje < f.dataRetorno) return "ativa";
  return "concluida";
}

const BADGE_STATUS: Record<StatusFerias, { label: string; className: string }> = {
  agendada: { label: "Agendada", className: "bg-sky-50 text-sky-700 border border-sky-200" },
  ativa: { label: "Em curso", className: "bg-amber-100 text-amber-800 border border-amber-300" },
  concluida: { label: "Concluída", className: "bg-slate-100 text-slate-600 border border-slate-300" },
};

export function FeriasMilitares({
  usuario: usuarioProp,
  ehAdmin,
  processos,
  ferias,
  onCriarFerias,
  onExcluirFerias,
  onRedistribuirFerias,
  onRedistribuirProcesso,
}: FeriasMilitaresProps) {
  const usuario = usuarioProp || {};
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [salvandoProprio, setSalvandoProprio] = useState(false);
  const [substitutoEscolhido, setSubstitutoEscolhido] = useState<Record<string, string>>({});
  const [movendoId, setMovendoId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as UsuarioLista)
        .filter((u) => u.ativo !== false);
      setUsuarios(lista);
    });
    return () => unsub();
  }, []);

  const hoje = dataCivilAtual();

  const minhasFerias = useMemo(
    () => ferias
      .filter((f) => f.userId === usuario.uid)
      .sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1)),
    [ferias, usuario.uid],
  );

  const feriasOrdenadas = useMemo(() => {
    const peso: Record<StatusFerias, number> = { ativa: 0, agendada: 1, concluida: 2 };
    return [...ferias].sort((a, b) => {
      const pa = peso[statusDaFerias(a, hoje)];
      const pb = peso[statusDaFerias(b, hoje)];
      if (pa !== pb) return pa - pb;
      return a.dataInicio < b.dataInicio ? 1 : -1;
    });
  }, [ferias, hoje]);

  async function handleRegistrarFerias(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.uid) {
      toast.error("Sessão sem identificação de usuário. Faça login novamente.");
      return;
    }
    if (!dataInicio || !dataRetorno) {
      toast.error("Informe a data de início e a data de retorno.");
      return;
    }
    if (dataRetorno <= dataInicio) {
      toast.error("A data de retorno deve ser posterior à data de início.");
      return;
    }

    const setor = normalizarSetorUsuario(usuario.setor || usuario.role || usuario.cargo);
    if (setor !== "DU" && setor !== "PA") {
      toast.error("Seu perfil não tem um setor (DU/PA) definido. Contate o administrador.");
      return;
    }

    setSalvandoProprio(true);
    try {
      await onCriarFerias({
        userId: usuario.uid,
        nomeMilitar: nomeMilitarUsuario(usuario),
        posto: usuario.posto || "",
        nomeGuerra: usuario.nomeGuerra || "",
        setor,
        dataInicio,
        dataRetorno,
        criadoPorUid: usuario.uid,
      });
      toast.success("Período de férias registrado.");
      setDataInicio("");
      setDataRetorno("");
    } catch (error) {
      console.error("Erro ao registrar férias:", error);
      toast.error("Não foi possível registrar o período.");
    } finally {
      setSalvandoProprio(false);
    }
  }

  async function handleExcluir(f: FeriasMilitar) {
    const confirmado = window.confirm(
      `Remover o período de férias de ${f.nomeMilitar} (${formatarData(f.dataInicio)} a ${formatarData(f.dataRetorno)})?`,
    );
    if (!confirmado) return;
    try {
      await onExcluirFerias(f.id);
      toast.success("Período removido.");
    } catch (error) {
      console.error("Erro ao remover férias:", error);
      toast.error("Não foi possível remover o período.");
    }
  }

  function processosAtivosDe(nomeMilitar: string) {
    return processos.filter((p) => (p.responsavel || "").trim() === nomeMilitar && !ehConcluido(p));
  }

  async function handleMoverProcessos(f: FeriasMilitar) {
    const substitutoUid = substitutoEscolhido[f.id];
    const substituto = usuarios.find((u) => (u.uid || u.id) === substitutoUid);
    if (!substituto) {
      toast.error("Selecione um substituto.");
      return;
    }

    const substitutoNome = nomeMilitarUsuario(substituto);
    if (substitutoNome === f.nomeMilitar) {
      toast.error("O substituto não pode ser o próprio militar em férias.");
      return;
    }

    const ativos = processosAtivosDe(f.nomeMilitar).filter(
      (p) => !f.processosRedistribuidos?.includes(p.id),
    );
    if (ativos.length === 0) {
      toast.info("Não há processos ativos para mover.");
      return;
    }

    setMovendoId(f.id);
    try {
      const mensagem = `Processo redistribuído: ${f.nomeMilitar} está de férias até ${formatarData(f.dataRetorno)}. Substituto: ${substitutoNome}.`;
      for (const p of ativos) {
        await onRedistribuirProcesso(p.id, substitutoNome, { mensagemHistorico: mensagem });
      }
      await onRedistribuirFerias(f.id, substituto.uid || substituto.id, substitutoNome, ativos.map((p) => p.id));
      toast.success(`${ativos.length} processo(s) movido(s) para ${substitutoNome}.`);
    } catch (error) {
      console.error("Erro ao mover processos de férias:", error);
      toast.error("Não foi possível mover todos os processos.");
    } finally {
      setMovendoId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 gap-8">
      <Card className="p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-extrabold text-lg text-foreground">Registrar minhas férias</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Enquanto o período estiver em curso, sua caixa fica bloqueada para novas distribuições.
            </p>
          </div>
        </div>

        <form onSubmit={handleRegistrarFerias} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Saída</label>
            <Input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Retorno</label>
            <Input type="date" required value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} />
          </div>
          <Button type="submit" disabled={salvandoProprio}>
            {salvandoProprio ? "Salvando..." : "Registrar período"}
          </Button>
        </form>

        {minhasFerias.length > 0 && (
          <div className="mt-5 space-y-2">
            {minhasFerias.map((f) => {
              const status = statusDaFerias(f, hoje);
              const badge = BADGE_STATUS[status];
              return (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="text-sm">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase mr-2 ${badge.className}`}>
                      {badge.label}
                    </span>
                    {formatarData(f.dataInicio)} até {formatarData(f.dataRetorno)}
                    {f.substitutoNome && (
                      <span className="text-muted-foreground"> — substituto: {f.substitutoNome}</span>
                    )}
                  </div>
                  {status === "agendada" && (
                    <Button size="sm" variant="outline" onClick={() => handleExcluir(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {ehAdmin && (
        <Card className="p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-extrabold text-lg text-foreground">Gestão de férias da equipe</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Mova os processos de quem está de férias para outro militar. O que não for finalizado retorna
                automaticamente para a caixa original no dia do retorno.
              </p>
            </div>
          </div>

          {feriasOrdenadas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum período de férias cadastrado ainda.</p>
          ) : (
            <div className="space-y-4">
              {feriasOrdenadas.map((f) => {
                const status = statusDaFerias(f, hoje);
                const badge = BADGE_STATUS[status];
                const ativosRestantes = processosAtivosDe(f.nomeMilitar).filter(
                  (p) => !f.processosRedistribuidos?.includes(p.id),
                );
                const vencidos = ativosRestantes.filter((p) => statusPrazo(prazoReferencia(p)) === "overdue").length;
                const noPrazo = ativosRestantes.length - vencidos;
                const substitutosDisponiveis = usuarios.filter(
                  (u) => u.setor === f.setor && (u.uid || u.id) !== f.userId,
                );

                return (
                  <div key={f.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-bold text-foreground flex items-center gap-2">
                          {f.nomeMilitar}
                          {status === "ativa" && <Lock className="h-3.5 w-3.5 text-amber-600" />}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {f.setor} · {formatarData(f.dataInicio)} até {formatarData(f.dataRetorno)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${badge.className}`}>
                          {badge.label}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => handleExcluir(f)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {status !== "concluida" && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                        <span>
                          Na caixa: <b className="text-foreground">{ativosRestantes.length}</b>
                        </span>
                        <span className="text-red-600">Vencidos <b>{vencidos}</b></span>
                        <span className="text-emerald-600">No prazo <b>{noPrazo}</b></span>
                      </div>
                    )}

                    {(f.processosRedistribuidos?.length || 0) > 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {f.processosRedistribuidos?.length} processo(s) já movido(s) para {f.substitutoNome}; retornam
                        automaticamente em {formatarData(f.dataRetorno)} se ainda não finalizados.
                      </p>
                    )}

                    {status !== "concluida" && ativosRestantes.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <select
                          className="border border-input rounded-lg p-2 text-xs outline-none bg-background"
                          value={substitutoEscolhido[f.id] || ""}
                          onChange={(e) => setSubstitutoEscolhido((atual) => ({ ...atual, [f.id]: e.target.value }))}
                        >
                          <option value="">Selecionar substituto...</option>
                          {substitutosDisponiveis.map((u) => (
                            <option key={u.id} value={u.uid || u.id}>
                              {nomeMilitarUsuario(u)}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => handleMoverProcessos(f)}
                          disabled={movendoId === f.id || !substitutoEscolhido[f.id]}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                          {movendoId === f.id ? "Movendo..." : `Mover ${ativosRestantes.length} processo(s)`}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default FeriasMilitares;
