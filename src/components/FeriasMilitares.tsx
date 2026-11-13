import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import {
  Plane,
  Lock,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Users as UsersIcon,
  AlertTriangle,
  Check,
  UserPlus,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import type { Processo } from "@/types/processo";
import type { FeriasMilitar, DistribuicaoFerias } from "@/hooks/useFeriasMilitares";
import { nomeMilitarUsuario } from "@/lib/userProfiles";
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

type SetorFerias = "DU" | "PA" | "GERAL";

type DadosNovaFerias = Omit<
  FeriasMilitar,
  "id" | "criadoEm" | "atualizadoEm" | "processosRedistribuidos" | "processosRevertidos" | "conflitosCientes" | "distribuicoes"
>;

interface FeriasMilitaresProps {
  usuario?: UsuarioLogado | null;
  ehAdmin: boolean;
  processos: Processo[];
  ferias: FeriasMilitar[];
  onCriarFerias: (dados: DadosNovaFerias) => Promise<void>;
  onExcluirFerias: (id: string) => Promise<void>;
  onEditarPeriodo: (id: string, dataInicio: string, dataRetorno: string) => Promise<void>;
  onReconhecerConflito: (idA: string, idB: string) => Promise<void>;
  onRedistribuirFerias: (id: string, distribuicoes: DistribuicaoFerias[]) => Promise<void>;
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

// A chefia geral (AsseApAssJur) não pertence a DU nem PA — qualquer outro
// valor de `setor` cadastrado em `usuarios` cai em "GERAL". Checagem direta
// no valor bruto (não usa normalizarSetorUsuario, que classifica "ASSJUR"/
// "ADMIN" como PA para outros fins e geraria o rótulo errado aqui).
function resolverSetorFerias(rawSetor: unknown): SetorFerias {
  const bruto = String(rawSetor || "").trim().toUpperCase();
  if (bruto === "DU") return "DU";
  if (bruto === "PA") return "PA";
  return "GERAL";
}

function rotuloSetor(setor: string): string {
  if (setor === "GERAL") return "Chefia Geral";
  return setor;
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

function periodosSeSobrepoem(a: FeriasMilitar, b: FeriasMilitar): boolean {
  return a.dataInicio < b.dataRetorno && b.dataInicio < a.dataRetorno;
}

export function FeriasMilitares({
  usuario: usuarioProp,
  ehAdmin,
  processos,
  ferias,
  onCriarFerias,
  onExcluirFerias,
  onEditarPeriodo,
  onReconhecerConflito,
  onRedistribuirFerias,
  onRedistribuirProcesso,
}: FeriasMilitaresProps) {
  const usuario = usuarioProp || {};
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [dataInicio, setDataInicio] = useState("");
  const [dataRetorno, setDataRetorno] = useState("");
  const [salvandoProprio, setSalvandoProprio] = useState(false);
  // Cada "caixa" de militar começa recolhida — só expande ao clicar, pra não
  // sobrecarregar a tela quando há muita gente na lista.
  const [linhasAbertas, setLinhasAbertas] = useState<Record<string, boolean>>({});
  // processoId -> selecionado (checkbox). Um mesmo destinatário é aplicado a
  // todos os processos marcados de uma vez; repetir a seleção com outro
  // destinatário permite dividir o lote entre vários assessores.
  const [processosSelecionados, setProcessosSelecionados] = useState<Record<string, boolean>>({});
  // feriasId -> uid do destinatário escolhido para o envio em lote.
  const [destinatarioPorFerias, setDestinatarioPorFerias] = useState<Record<string, string>>({});
  const [movendoId, setMovendoId] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editInicio, setEditInicio] = useState("");
  const [editRetorno, setEditRetorno] = useState("");
  const [militarSelecionadoId, setMilitarSelecionadoId] = useState("");
  const [dataInicioAdmin, setDataInicioAdmin] = useState("");
  const [dataRetornoAdmin, setDataRetornoAdmin] = useState("");
  const [salvandoAdmin, setSalvandoAdmin] = useState(false);

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

  const feriasOrdenadas = useMemo(() => {
    const peso: Record<StatusFerias, number> = { ativa: 0, agendada: 1, concluida: 2 };
    return [...ferias].sort((a, b) => {
      const pa = peso[statusDaFerias(a, hoje)];
      const pb = peso[statusDaFerias(b, hoje)];
      if (pa !== pb) return pa - pb;
      return a.dataInicio < b.dataInicio ? 1 : -1;
    });
  }, [ferias, hoje]);

  // Conflitos: períodos de militares DIFERENTES que se sobrepõem, ainda não
  // concluídos e ainda não reconhecidos pela chefia (ver reconhecerConflito).
  // Some sozinho da lista quando o período passa — não precisa de limpeza.
  const conflitos = useMemo(() => {
    const emAberto = ferias.filter((f) => statusDaFerias(f, hoje) !== "concluida");
    const pares: { a: FeriasMilitar; b: FeriasMilitar }[] = [];
    for (let i = 0; i < emAberto.length; i++) {
      for (let j = i + 1; j < emAberto.length; j++) {
        const a = emAberto[i];
        const b = emAberto[j];
        if (a.userId === b.userId) continue;
        if (!periodosSeSobrepoem(a, b)) continue;
        const reconhecido = (a.conflitosCientes || []).includes(b.id) || (b.conflitosCientes || []).includes(a.id);
        if (reconhecido) continue;
        pares.push({ a, b });
      }
    }
    return pares;
  }, [ferias, hoje]);

  function toggleLinha(id: string) {
    setLinhasAbertas((atual) => ({ ...atual, [id]: !atual[id] }));
  }

  function toggleSelecionado(processoId: string) {
    setProcessosSelecionados((atual) => ({ ...atual, [processoId]: !atual[processoId] }));
  }

  function selecionarTodos(processoIds: string[], valor: boolean) {
    setProcessosSelecionados((atual) => {
      const novo = { ...atual };
      processoIds.forEach((id) => { novo[id] = valor; });
      return novo;
    });
  }

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

    setSalvandoProprio(true);
    try {
      await onCriarFerias({
        userId: usuario.uid,
        nomeMilitar: nomeMilitarUsuario(usuario),
        posto: usuario.posto || "",
        nomeGuerra: usuario.nomeGuerra || "",
        setor: resolverSetorFerias(usuario.setor),
        dataInicio,
        dataRetorno,
        criadoPorUid: usuario.uid,
      });
      toast.success("Período de férias registrado. Confira no Plano de Férias abaixo.");
      setDataInicio("");
      setDataRetorno("");
    } catch (error) {
      console.error("Erro ao registrar férias:", error);
      toast.error("Não foi possível registrar o período.");
    } finally {
      setSalvandoProprio(false);
    }
  }

  async function handleLancarParaMilitar(e: React.FormEvent) {
    e.preventDefault();
    const alvo = usuarios.find((u) => (u.uid || u.id) === militarSelecionadoId);
    if (!alvo) {
      toast.error("Selecione o militar.");
      return;
    }
    if (!dataInicioAdmin || !dataRetornoAdmin) {
      toast.error("Informe a data de início e a data de retorno.");
      return;
    }
    if (dataRetornoAdmin <= dataInicioAdmin) {
      toast.error("A data de retorno deve ser posterior à data de início.");
      return;
    }

    setSalvandoAdmin(true);
    try {
      const uidAlvo = alvo.uid || alvo.id;
      await onCriarFerias({
        userId: uidAlvo,
        nomeMilitar: nomeMilitarUsuario(alvo),
        posto: alvo.posto || "",
        nomeGuerra: alvo.nomeGuerra || "",
        setor: resolverSetorFerias(alvo.setor),
        dataInicio: dataInicioAdmin,
        dataRetorno: dataRetornoAdmin,
        criadoPorUid: usuario.uid || "",
      });
      toast.success(`Férias de ${nomeMilitarUsuario(alvo)} registradas.`);
      setMilitarSelecionadoId("");
      setDataInicioAdmin("");
      setDataRetornoAdmin("");
    } catch (error) {
      console.error("Erro ao lançar férias para militar:", error);
      toast.error("Não foi possível registrar o período.");
    } finally {
      setSalvandoAdmin(false);
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

  function iniciarEdicao(f: FeriasMilitar) {
    setEditandoId(f.id);
    setEditInicio(f.dataInicio);
    setEditRetorno(f.dataRetorno);
  }

  function cancelarEdicao() {
    setEditandoId(null);
  }

  async function salvarEdicao() {
    if (!editandoId) return;
    if (!editInicio || !editRetorno || editRetorno <= editInicio) {
      toast.error("Datas inválidas: o retorno deve ser depois da saída.");
      return;
    }
    try {
      await onEditarPeriodo(editandoId, editInicio, editRetorno);
      toast.success("Período atualizado.");
      setEditandoId(null);
    } catch (error) {
      console.error("Erro ao editar período de férias:", error);
      toast.error("Não foi possível atualizar o período.");
    }
  }

  async function handleReconhecerConflito(idA: string, idB: string) {
    try {
      await onReconhecerConflito(idA, idB);
      toast.success("Ciente registrado.");
    } catch (error) {
      console.error("Erro ao reconhecer conflito de férias:", error);
      toast.error("Não foi possível registrar o ciente.");
    }
  }

  function processosAtivosDe(nomeMilitar: string) {
    return processos.filter((p) => (p.responsavel || "").trim() === nomeMilitar && !ehConcluido(p));
  }

  async function handleEnviarSelecionados(f: FeriasMilitar, ativosRestantes: Processo[]) {
    const uid = destinatarioPorFerias[f.id];
    const substituto = usuarios.find((u) => (u.uid || u.id) === uid);
    if (!substituto) {
      toast.error("Selecione o assessor destinatário.");
      return;
    }

    const substitutoNome = nomeMilitarUsuario(substituto);
    if (substitutoNome === f.nomeMilitar) {
      toast.error("O destinatário não pode ser o próprio militar em férias.");
      return;
    }

    const selecionados = ativosRestantes.filter((p) => processosSelecionados[p.id]);
    if (selecionados.length === 0) {
      toast.error("Marque ao menos um processo para enviar.");
      return;
    }

    setMovendoId(f.id);
    try {
      const mensagem = `Processo redistribuído: ${f.nomeMilitar} está de férias até ${formatarData(f.dataRetorno)}. Substituto: ${substitutoNome}.`;
      for (const p of selecionados) {
        await onRedistribuirProcesso(p.id, substitutoNome, { mensagemHistorico: mensagem });
      }
      const distribuicoes: DistribuicaoFerias[] = selecionados.map((p) => ({
        processoId: p.id,
        substitutoUid: uid,
        substitutoNome,
      }));
      await onRedistribuirFerias(f.id, distribuicoes);
      toast.success(`${selecionados.length} processo(s) enviado(s) para ${substitutoNome}.`);
      setProcessosSelecionados((atual) => {
        const novo = { ...atual };
        selecionados.forEach((p) => { delete novo[p.id]; });
        return novo;
      });
    } catch (error) {
      console.error("Erro ao mover processos de férias:", error);
      toast.error("Não foi possível mover todos os processos.");
    } finally {
      setMovendoId(null);
    }
  }

  // Bloco de data (texto ou formulário de edição) + botões de ação,
  // reaproveitado em todas as linhas do Plano de Férias.
  function renderPeriodo(f: FeriasMilitar, podeGerenciar: boolean) {
    const status = statusDaFerias(f, hoje);
    const podeEditar = podeGerenciar && status !== "concluida";
    // Excluir um período "em curso" apagaria o rastro dos processos
    // redistribuídos por causa dele, impedindo o retorno automático —
    // por isso só libera exclusão de períodos ainda não iniciados ou já
    // concluídos (apenas para limpeza histórica).
    const podeExcluir = podeGerenciar && status !== "ativa";

    if (editandoId === f.id) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} className="h-8 w-auto text-xs" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={editRetorno} onChange={(e) => setEditRetorno(e.target.value)} className="h-8 w-auto text-xs" />
          <Button size="sm" onClick={salvarEdicao}>Salvar</Button>
          <Button size="sm" variant="outline" onClick={cancelarEdicao}>Cancelar</Button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span>{formatarData(f.dataInicio)} até {formatarData(f.dataRetorno)}</span>
        {(podeEditar || podeExcluir) && (
          <span className="flex items-center gap-1.5">
            {podeEditar && (
              <Button size="sm" variant="outline" onClick={() => iniciarEdicao(f)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {podeExcluir && (
              <Button size="sm" variant="outline" onClick={() => handleExcluir(f)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1700px] mx-auto grid grid-cols-1 gap-8 px-2">
      {ehAdmin && conflitos.length > 0 && (
        <Card className="p-6 border-2 border-amber-400 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-3">
              <h4 className="font-bold text-amber-900">Períodos de férias sobrepostos</h4>
              {conflitos.map(({ a, b }) => (
                <div key={`${a.id}_${b.id}`} className="flex items-center justify-between gap-3 flex-wrap text-sm text-amber-900">
                  <span>
                    <b>{a.nomeMilitar}</b> ({formatarData(a.dataInicio)}–{formatarData(a.dataRetorno)}) e{" "}
                    <b>{b.nomeMilitar}</b> ({formatarData(b.dataInicio)}–{formatarData(b.dataRetorno)}) estão de férias
                    em período que se sobrepõe.
                  </span>
                  <Button size="sm" variant="outline" onClick={() => handleReconhecerConflito(a.id, b.id)}>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Dar ciente
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-8 shadow-lg">
        <div className="mb-5 flex items-center gap-2">
          <Plane className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-extrabold text-xl text-foreground">Registrar minhas férias</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enquanto o período estiver em curso, sua caixa fica bloqueada para novas distribuições. Seus
              períodos aparecem no Plano de Férias abaixo, onde também é possível editá-los.
            </p>
          </div>
        </div>

        <form onSubmit={handleRegistrarFerias} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end max-w-2xl">
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
      </Card>

      <Card className="p-8 shadow-lg">
        <div className="mb-5 flex items-center gap-2">
          <UsersIcon className="h-6 w-6 text-primary" />
          <div>
            <h3 className="font-extrabold text-xl text-foreground">Plano de Férias</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {ehAdmin
                ? "Visão de toda a equipe. Clique em um militar para abrir, lançar/editar o período e distribuir os processos de quem está ausente — marque os processos e escolha para quem enviar."
                : "Visão de toda a equipe. Clique em um militar para ver detalhes. Você só pode editar o seu próprio período."}
            </p>
          </div>
        </div>

        {ehAdmin && (
          <form onSubmit={handleLancarParaMilitar} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8 pb-8 border-b border-border">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Militar</label>
              <select
                required
                className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background"
                value={militarSelecionadoId}
                onChange={(e) => setMilitarSelecionadoId(e.target.value)}
              >
                <option value="">Selecionar...</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.uid || u.id}>
                    {nomeMilitarUsuario(u)} ({rotuloSetor(resolverSetorFerias(u.setor))})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Saída</label>
              <Input type="date" required value={dataInicioAdmin} onChange={(e) => setDataInicioAdmin(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Retorno</label>
              <Input type="date" required value={dataRetornoAdmin} onChange={(e) => setDataRetornoAdmin(e.target.value)} />
            </div>
            <Button type="submit" disabled={salvandoAdmin} className="md:col-span-4 w-full md:w-auto">
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              {salvandoAdmin ? "Salvando..." : "Lançar férias para este militar"}
            </Button>
          </form>
        )}

        {feriasOrdenadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum período de férias cadastrado ainda.</p>
        ) : (
          <div className="space-y-3">
            {feriasOrdenadas.map((f) => {
              const status = statusDaFerias(f, hoje);
              const badge = BADGE_STATUS[status];
              const podeGerenciar = ehAdmin || f.userId === usuario.uid;
              const aberta = !!linhasAbertas[f.id];
              const ativosRestantes = ehAdmin
                ? processosAtivosDe(f.nomeMilitar).filter((p) => !f.processosRedistribuidos?.includes(p.id))
                : [];
              const vencidos = ativosRestantes.filter((p) => statusPrazo(prazoReferencia(p)) === "overdue").length;
              const noPrazo = ativosRestantes.length - vencidos;
              const substitutosDisponiveis = usuarios.filter(
                (u) => (f.setor === "GERAL" || u.setor === f.setor) && (u.uid || u.id) !== f.userId,
              );
              const distribuicoesPendentes = (f.distribuicoes || []).filter(
                (d) => f.processosRedistribuidos?.includes(d.processoId),
              );
              const porSubstituto = new Map<string, number>();
              distribuicoesPendentes.forEach((d) => porSubstituto.set(d.substitutoNome, (porSubstituto.get(d.substitutoNome) || 0) + 1));
              const idsAtivos = ativosRestantes.map((p) => p.id);
              const qtdSelecionados = idsAtivos.filter((id) => processosSelecionados[id]).length;
              const todosSelecionados = idsAtivos.length > 0 && qtdSelecionados === idsAtivos.length;

              return (
                <div key={f.id} className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleLinha(f.id)}
                    className="w-full flex items-center justify-between gap-3 flex-wrap p-4 text-left hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {aberta ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-lg text-foreground flex items-center gap-2 truncate">
                          {f.nomeMilitar}
                          {status === "ativa" && <Lock className="h-4 w-4 text-amber-600 shrink-0" />}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {rotuloSetor(f.setor)} · {formatarData(f.dataInicio)} até {formatarData(f.dataRetorno)}
                        </p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </button>

                  {aberta && (
                    <div className="px-4 pb-4 border-t border-border pt-4">
                      {podeGerenciar && (
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase">Período:</span>
                          {renderPeriodo(f, true)}
                        </div>
                      )}

                      {ehAdmin && status !== "concluida" && (
                        <div className="flex items-center gap-3 flex-wrap text-xs mb-2">
                          <span>
                            Na caixa: <b className="text-foreground">{ativosRestantes.length}</b>
                          </span>
                          <span className="text-red-600">Vencidos <b>{vencidos}</b></span>
                          <span className="text-emerald-600">No prazo <b>{noPrazo}</b></span>
                        </div>
                      )}

                      {porSubstituto.size > 0 && (
                        <p className="text-xs text-muted-foreground mb-2">
                          {Array.from(porSubstituto.entries()).map(([nome, qtd]) => `${qtd} para ${nome}`).join(", ")}; retornam
                          automaticamente em {formatarData(f.dataRetorno)} se ainda não finalizados.
                        </p>
                      )}

                      {ehAdmin && status !== "concluida" && ativosRestantes.length > 0 && (
                        <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={todosSelecionados}
                              onChange={(e) => selecionarTodos(idsAtivos, e.target.checked)}
                              className="h-4 w-4"
                            />
                            <p className="text-xs font-bold text-muted-foreground uppercase">
                              Selecionar todos ({ativosRestantes.length})
                            </p>
                          </div>

                          <div className="space-y-1.5 max-h-80 overflow-y-auto">
                            {ativosRestantes.map((p) => {
                              const vencido = statusPrazo(prazoReferencia(p)) === "overdue";
                              return (
                                <label
                                  key={p.id}
                                  className="flex items-center gap-3 rounded-md bg-background p-2 border border-border/60 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={!!processosSelecionados[p.id]}
                                    onChange={() => toggleSelecionado(p.id)}
                                    className="h-4 w-4 shrink-0"
                                  />
                                  <div className="min-w-0 flex-1 text-sm">
                                    <span className="font-semibold text-foreground">{p.numero}</span>
                                    <span className="text-muted-foreground"> — {p.cliente}</span>
                                    <span className={`ml-2 text-[10px] font-bold uppercase ${vencido ? "text-red-600" : "text-emerald-600"}`}>
                                      {vencido ? "Vencido" : "No prazo"}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          <div className="mt-3 flex items-center gap-2 flex-wrap justify-end">
                            <select
                              className="border border-input rounded-lg p-2 text-xs outline-none bg-background"
                              value={destinatarioPorFerias[f.id] || ""}
                              onChange={(e) => setDestinatarioPorFerias((atual) => ({ ...atual, [f.id]: e.target.value }))}
                            >
                              <option value="">Selecionar assessor destinatário...</option>
                              {substitutosDisponiveis.map((u) => (
                                <option key={u.id} value={u.uid || u.id}>
                                  {nomeMilitarUsuario(u)}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              onClick={() => handleEnviarSelecionados(f, ativosRestantes)}
                              disabled={movendoId === f.id || qtdSelecionados === 0 || !destinatarioPorFerias[f.id]}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                              {movendoId === f.id ? "Enviando..." : `Enviar ${qtdSelecionados || ""} selecionado(s)`}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

export default FeriasMilitares;
