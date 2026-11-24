import { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdminUniversal } from "@/hooks/useAuth";
import { useComandoAssJur, type PapelComando } from "@/hooks/useComandoAssJur";
import { nomeMilitarUsuario } from "@/lib/userProfiles";
import { formatarData } from "@/lib/prazo";

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

interface AjustesComandoProps {
  openComando: boolean;
  setOpenComando: (open: boolean) => void;
}

function dataCivilAtual(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ehChefeGeralSetor(setor: unknown): boolean {
  return String(setor || "").trim().toUpperCase() === "CHEFE ASSEAPASSJUR";
}

// V4.8 — Painel de Comando da AssJur, compartilhado por dois assentos
// diferentes: o Admin Universal (papel "DONO", delega TUDO — inclusive
// branding/contas) e o Chefe Geral da AssJur, cargo permanente (papel
// "CHEFE_GERAL", delega só o próprio assento operacional, pra cobrir as
// próprias ausências). Cada um só vê/gerencia a delegação do PRÓPRIO
// assento — ver firestore.rules para a separação real de poderes.
export function AjustesComando({ openComando, setOpenComando }: AjustesComandoProps) {
  const { user } = useAuth();
  const { comando, delegar, revogar } = useComandoAssJur();
  const [usuarios, setUsuarios] = useState<UsuarioLista[]>([]);
  const [militarSelecionadoId, setMilitarSelecionadoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [revogando, setRevogando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "usuarios"), (snapshot) => {
      const lista = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as UsuarioLista)
        .filter((u) => u.ativo !== false);
      setUsuarios(lista);
    });
    return () => unsub();
  }, []);

  const souDono = isAdminUniversal(user);
  const souChefeGeral = ehChefeGeralSetor(user?.setor);
  // Dono sempre prevalece quando as duas coisas forem verdade na mesma
  // conta (ex.: o próprio dono também está com o setor "Chefe AsseApAssJur").
  const papelTitular: PapelComando | null = souDono ? "DONO" : souChefeGeral ? "CHEFE_GERAL" : null;
  const souTitular = !!papelTitular;

  const hoje = dataCivilAtual();
  // dataFim é exclusivo: o 1º dia de volta ao comando normal — mesma
  // convenção de [dataInicio, dataFim) usada em Férias de Militares.
  const comandoVigente = !!comando && hoje < comando.dataFim;
  const comandoEmCurso = comandoVigente && comando && hoje >= comando.dataInicio;

  // V4.9 — Quem RECEBEU um comando delegado também precisa enxergar esta
  // seção (pelo menos pra poder devolver o comando antes do prazo acabar,
  // se quiser) — antes só o titular real (dono/Chefe Geral) via acesso.
  const souDelegadoAtivoDesteAssento =
    comandoVigente && comando?.delegadoUid === user?.uid ? comando.papel : null;
  const meuPapel: PapelComando | null = papelTitular || souDelegadoAtivoDesteAssento;

  if (!meuPapel) return null;

  const comandoEhDoMeuAssento = comando?.papel === meuPapel;
  const tituloAssento = meuPapel === "DONO" ? "comando geral do site" : "comando da Chefia Geral";

  async function handleDelegar(e: React.FormEvent) {
    e.preventDefault();
    if (!papelTitular) return;
    const alvo = usuarios.find((u) => (u.uid || u.id) === militarSelecionadoId);
    if (!alvo) {
      toast.error("Selecione o militar que vai receber o comando.");
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error("Informe a data de início e a data de fim.");
      return;
    }
    if (dataFim <= dataInicio) {
      toast.error("A data de fim deve ser posterior à data de início.");
      return;
    }
    if (!user?.uid) {
      toast.error("Sessão sem identificação de usuário. Faça login novamente.");
      return;
    }

    // Já existe uma delegação ativa de OUTRO assento — como só existe um
    // registro por vez, criar a minha agora substituiria a dela.
    if (comandoVigente && comando && comando.papel !== papelTitular) {
      if (papelTitular === "CHEFE_GERAL") {
        toast.error("Já existe uma delegação ativa do comando geral do site — não é possível criar a sua agora. Avise o Admin Universal.");
        return;
      }
      const confirmarSobrescrita = window.confirm(
        "Já existe uma delegação ativa do Chefe Geral (não sua). Criar uma nova aqui vai substituí-la. Quer continuar?",
      );
      if (!confirmarSobrescrita) return;
    }

    setSalvando(true);
    try {
      await delegar({
        papel: papelTitular,
        delegadoUid: alvo.uid || alvo.id,
        delegadoNome: nomeMilitarUsuario(alvo),
        delegadorUid: user.uid,
        delegadorNome: user.nomeGuerra || user.nome || "Chefia",
        dataInicio,
        dataFim,
      });
      toast.success(`Comando transferido para ${nomeMilitarUsuario(alvo)}.`);
      setMilitarSelecionadoId("");
      setDataInicio("");
      setDataFim("");
    } catch (error) {
      console.error("Erro ao transferir comando da AssJur:", error);
      toast.error("Não foi possível transferir o comando.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRevogar() {
    const confirmado = window.confirm(
      "Revogar o comando delegado e retomar o controle agora? Você volta imediatamente ao modo normal (deixa de ser observador).",
    );
    if (!confirmado) return;
    setRevogando(true);
    try {
      await revogar();
      toast.success("Comando revogado. Você está no controle novamente.");
    } catch (error) {
      console.error("Erro ao revogar comando da AssJur:", error);
      toast.error("Não foi possível revogar o comando.");
    } finally {
      setRevogando(false);
    }
  }

  return (
    <Collapsible open={openComando} onOpenChange={setOpenComando}>
      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              <Crown className="h-4 w-4 text-slate-500" />
              Comando da AssJur
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              {meuPapel === "DONO"
                ? "Transfira temporariamente o comando geral do site para outro militar durante sua ausência."
                : "Transfira temporariamente o comando da Chefia Geral para outro militar durante sua ausência (férias, missão, etc.)."}
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openComando ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4 space-y-4">
          {comando && (
            <div className={`rounded-xl border p-3 text-sm ${comandoEmCurso ? "border-amber-300 bg-amber-50" : comandoVigente ? "border-sky-300 bg-sky-50" : "border-border bg-muted/30"}`}>
              <p className="font-bold text-foreground">
                {!comandoEhDoMeuAssento
                  ? `Delegação ativa de outro assento (${comando.papel === "DONO" ? "comando geral do site" : "Chefia Geral"})`
                  : comandoEmCurso
                    ? "Comando delegado em curso"
                    : comandoVigente
                      ? "Delegação agendada"
                      : "Última delegação (encerrada)"}
              </p>
              <p className="text-muted-foreground mt-1">
                {comando.delegadoNome} — {formatarData(comando.dataInicio)} até {formatarData(comando.dataFim)}
              </p>
              {comandoVigente && (comandoEhDoMeuAssento || papelTitular === "DONO") && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-3"
                  onClick={handleRevogar}
                  disabled={revogando}
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  {revogando
                    ? "Revogando..."
                    : souTitular
                      ? "Revogar e retomar o comando"
                      : "Devolver o comando agora"}
                </Button>
              )}
            </div>
          )}

          {souTitular ? (
            <>
              <form onSubmit={handleDelegar} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Militar</label>
                  <select
                    required
                    className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background"
                    value={militarSelecionadoId}
                    onChange={(e) => setMilitarSelecionadoId(e.target.value)}
                  >
                    <option value="">Selecionar...</option>
                    {usuarios
                      .filter((u) => (u.uid || u.id) !== user?.uid)
                      .map((u) => (
                        <option key={u.id} value={u.uid || u.id}>
                          {nomeMilitarUsuario(u)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Início</label>
                  <Input type="date" required value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Fim</label>
                  <Input type="date" required value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
                <Button type="submit" disabled={salvando} className="md:col-span-4 w-full md:w-auto">
                  {salvando ? "Transferindo..." : "Transferir comando"}
                </Button>
              </form>

              <p className="text-xs text-muted-foreground">
                Enquanto a delegação estiver em curso, quem recebe o {tituloAssento} pode gerenciar processos,
                equipe e férias normalmente; você passa a observador — continua vendo tudo, mas nenhuma alteração
                sua é aceita até o fim do período ou até você revogar.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Você está com o {tituloAssento} temporariamente delegado. Só quem delegou pode escolher um novo
              destinatário; você pode devolver o comando a qualquer momento com o botão acima.
            </p>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default AjustesComando;
