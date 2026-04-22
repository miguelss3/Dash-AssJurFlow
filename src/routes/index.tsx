import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SoldierAvatar } from "@/components/SoldierAvatar";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import {
  Scale,
  Plus,
  Search,
  LayoutGrid,
  BarChart3,
  Bell,
  Menu,
  X,
  Settings,
  LogOut,
  Calendar,
  History,
  FolderArchive,
  Users,
  ListFilter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProcessos } from "@/hooks/useProcessos";
import { Dashboard } from "@/components/Dashboard";
import { MesaTrabalho } from "@/components/MesaTrabalho";
import type { Processo, StatusProcesso, FiltroPrazo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";
import { toast } from "sonner";

const KanbanBoard = lazy(() =>
  import("@/components/KanbanBoard").then((m) => ({ default: m.KanbanBoard })),
);
const CadastroProcessoModal = lazy(() =>
  import("@/components/CadastroProcessoModal").then((m) => ({ default: m.CadastroProcessoModal })),
);
const Estatisticas = lazy(() =>
  import("@/components/Estatisticas").then((m) => ({ default: m.Estatisticas })),
);
const CalendarioPrazos = lazy(() =>
  import("@/components/CalendarioPrazos").then((m) => ({ default: m.CalendarioPrazos })),
);
const GestaoEquipe = lazy(() =>
  import("@/components/GestaoEquipe").then((m) => ({ default: m.GestaoEquipe })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AssJur Flow — 12ª Região Militar" },
      {
        name: "description",
        content:
          "Sistema de Assessoria Jurídica da 12ª Região Militar — gestão de DU, PA, prazos e indicadores.",
      },
      { property: "og:title", content: "AssJur Flow — 12ª Região Militar" },
      {
        property: "og:description",
        content:
          "Mesa de trabalho jurídica com Kanban por assessor, controle de prazos e indicadores de gestão.",
      },
    ],
  }),
  component: Index,
  errorComponent: ({ error }) => {
    console.error("❌ Erro na rota index:", error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-red-500">
            <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Erro ao Carregar Dashboard</h1>
          <p className="mt-3 text-sm text-slate-600">
            {error.message || "Ocorreu um erro ao carregar os dados. Verifique sua conexão e as regras do Firebase."}
          </p>
          <div className="mt-6 space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Tentar Novamente
            </button>
            <a
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Voltar ao Login
            </a>
          </div>
        </div>
      </div>
    );
  },
});

type Aba = "mesa" | "prazos" | "arquivo" | "indicadores" | "equipe";
type FiltroTipo = "todos" | "DU" | "PA";

type NotificacaoItem = {
  id: string;
  titulo: string;
  texto: string;
  momentoISO: string;
};

function normalizarSetor(valor: unknown): "DU" | "PA" | "" {
  const txt = String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (!txt) return "";
  if (txt === "DU" || txt.includes("DEFESA") || txt.includes("USUARIO")) return "DU";
  if (txt === "PA" || txt.includes("PROCESSO") || txt.includes("ADMIN")) return "PA";
  return "";
}

function normalizarTexto(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatarDataHora(valorISO: string): string {
  const dt = new Date(valorISO);
  if (Number.isNaN(dt.getTime())) return "data indisponivel";
  return dt.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function processoTimestampMs(p: Processo | undefined): number {
  if (!p) return 0;
  const dt = new Date(p.atualizadoEm || p.criadoEm).getTime();
  return Number.isNaN(dt) ? 0 : dt;
}

function Index() {
  const navigate = useNavigate();
  const { user, ready, logout } = useAuth();
  const { processos, criar, atualizar, remover } = useProcessos();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Processo | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<StatusProcesso>("novo");
  const [filtro, setFiltro] = useState<FiltroPrazo>("todos");
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>("mesa");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilSaving, setPerfilSaving] = useState(false);
  const [perfilNome, setPerfilNome] = useState("");
  const [perfilNomeGuerra, setPerfilNomeGuerra] = useState("");
  const [perfilEmail, setPerfilEmail] = useState("");
  const [perfilTelefone, setPerfilTelefone] = useState("");
  const [perfilSenha, setPerfilSenha] = useState("");
  const [perfilSenhaConfirmacao, setPerfilSenhaConfirmacao] = useState("");
  const [notificacoesOpen, setNotificacoesOpen] = useState(false);
  const [ultimoAcessoNotificacoes, setUltimoAcessoNotificacoes] = useState<number>(0);
  const [notificacoesCalendario, setNotificacoesCalendario] = useState<NotificacaoItem[]>([]);
  const [processosLidos, setProcessosLidos] = useState<Record<string, number>>({});
  const notificacoesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ready && !user) navigate({ to: "/login" });
  }, [ready, user, navigate]);

  // Usuário logado (sem fallback fixo para evitar flicker visual no reload)
  const usuario = user ?? { posto: "", nome: "", role: "", setor: "" };
  const ehAdmin = isAdmin(user);
  const setorUsuario = normalizarSetor(usuario.setor || usuario.role || usuario.secao || usuario.cargo);

  const isPendenteChefia = (p: Processo) => {
    const situacaoFluxo = p.pedidoSubsidios?.situacaoFluxo || "";
    const statusNorm = (p.status || "").toString().toLowerCase();
    return [
      "aguardando_assinatura_secao",
      "aguardando_aprovacao_externa",
      "enviado_admin",
      "assinado_externo",
      "CHEFIA_DILIGENCIA",
      "CHEFIA_DEFESA",
      "AGUARDANDO_RESPOSTA",
    ].includes(situacaoFluxo)
      || statusNorm.includes("aguardando assinatura")
      || statusNorm.includes("aguardando conferencia da chefia");
  };

  // Todos operam na Visão do Setor
  useEffect(() => {
    // Assessores veem apenas processos do seu setor (DU ou PA)
    if (!ehAdmin && setorUsuario && filtroTipo === "todos") {
      setFiltroTipo(setorUsuario);
    }
  }, [ehAdmin, setorUsuario, filtroTipo]);

  // Filtra dados para dashboard/indicadores: assessor vê só seu setor, admin vê todos
  const processosParaDashboard = useMemo(() => {
    if (ehAdmin) {
      return processos;
    }
    
    return processos.filter((p) => {
      const setorProcesso = normalizarSetor(p.setor || p.tipo);
      return setorProcesso === setorUsuario;
    });
  }, [processos, ehAdmin, setorUsuario]);

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
      const setorProcesso = normalizarSetor(p.setor || p.tipo);

      if (filtroTipo !== "todos" && setorProcesso !== filtroTipo) return false;
      
      // FILTRO "VISÃO DO SETOR": para assessores não-admin, mostra apenas processos do seu setor (DU ou PA)
      if (!ehAdmin && setorUsuario) {
        if (setorProcesso !== setorUsuario) {
          return false;
        }
      }
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const hit =
          p.numero.toLowerCase().includes(q) ||
          p.cliente.toLowerCase().includes(q) ||
          p.parteContraria.toLowerCase().includes(q) ||
          p.responsavel.toLowerCase().includes(q) ||
          p.tipoAcao.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filtro === "todos") return true;
      if (p.status === "concluido") return false;
      const s = statusPrazo(p.prazo);
      if (filtro === "vencidos") return s === "overdue";
      if (filtro === "hoje") return s === "today";
      if (filtro === "semana") return s === "today" || s === "soon";
      return true;
    });
  }, [processos, filtro, busca, filtroTipo, usuario.posto, usuario.nome, setorUsuario, ehAdmin]);

  const nomeMilitarAtual = useMemo(() => {
    if (!user) return "Sistema";
    const nomeBase = user.nomeGuerra || user.nome || user.email?.split("@")[0] || "Usuário";
    return user.posto ? `${user.posto} ${nomeBase}`.trim() : nomeBase;
  }, [user]);

  const chaveNotificacoes = useMemo(
    () => (user?.uid ? `assjur:notificacoes:lastSeen:${user.uid}` : ""),
    [user?.uid],
  );

  const chaveNotificacoesCalendario = useMemo(
    () => (user?.uid ? `assjur:notificacoes:calendario:${user.uid}` : ""),
    [user?.uid],
  );

  const chaveProcessosLidos = useMemo(
    () => (user?.uid ? `assjur:processos:lidos:${user.uid}` : ""),
    [user?.uid],
  );

  useEffect(() => {
    if (!chaveNotificacoes) {
      setUltimoAcessoNotificacoes(0);
      return;
    }

    try {
      const raw = window.localStorage.getItem(chaveNotificacoes);
      if (raw) {
        const valor = Number(raw);
        setUltimoAcessoNotificacoes(Number.isFinite(valor) ? valor : Date.now());
      } else {
        const agora = Date.now();
        window.localStorage.setItem(chaveNotificacoes, String(agora));
        setUltimoAcessoNotificacoes(agora);
      }
    } catch {
      setUltimoAcessoNotificacoes(Date.now());
    }
  }, [chaveNotificacoes]);

  useEffect(() => {
    if (!chaveNotificacoesCalendario) {
      setNotificacoesCalendario([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(chaveNotificacoesCalendario);
      if (!raw) {
        setNotificacoesCalendario([]);
        return;
      }
      const parsed = JSON.parse(raw) as NotificacaoItem[];
      setNotificacoesCalendario(Array.isArray(parsed) ? parsed : []);
    } catch {
      setNotificacoesCalendario([]);
    }
  }, [chaveNotificacoesCalendario]);

  useEffect(() => {
    if (!chaveProcessosLidos) {
      setProcessosLidos({});
      return;
    }

    try {
      const raw = window.localStorage.getItem(chaveProcessosLidos);
      if (!raw) {
        setProcessosLidos({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, number>;
      setProcessosLidos(parsed && typeof parsed === "object" ? parsed : {});
    } catch {
      setProcessosLidos({});
    }
  }, [chaveProcessosLidos]);

  const processosNaoLidosIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of processos) {
      const ts = processoTimestampMs(p);
      const lidoEm = processosLidos[p.id] || 0;
      if (ts > lidoEm) ids.add(p.id);
    }
    return ids;
  }, [processos, processosLidos]);

  const marcarProcessoComoLido = (processoId: string) => {
    const processo = processos.find((p) => p.id === processoId);
    if (!processo) return;

    const ts = processoTimestampMs(processo);
    setProcessosLidos((prev) => {
      if ((prev[processoId] || 0) >= ts) return prev;
      const next = { ...prev, [processoId]: ts };
      if (chaveProcessosLidos) {
        try {
          window.localStorage.setItem(chaveProcessosLidos, JSON.stringify(next));
        } catch {
          // sem persistencia local
        }
      }
      return next;
    });
  };

  const notificacoesAssessor = useMemo(() => {
    if (ehAdmin || !user) return [] as NotificacaoItem[];

    const candidatos = [
      nomeMilitarAtual,
      `${user.posto || ""} ${user.nome || ""}`.trim(),
      user.nome,
      user.nomeGuerra,
      user.email?.split("@")[0],
    ]
      .map((v) => normalizarTexto(v))
      .filter((v) => v.length >= 3);

    const pertenceAoAssessor = (p: Processo) => {
      const respNorm = normalizarTexto(p.responsavel);
      if (!respNorm) return false;
      return candidatos.some((c) => respNorm.includes(c) || c.includes(respNorm));
    };

    return processos
      .filter(pertenceAoAssessor)
      .map((p) => ({
        id: p.id,
        titulo: `Processo ${p.numero}`,
        texto: p.descricao || "Movimentacao atualizada.",
        momentoISO: p.atualizadoEm || p.criadoEm,
      }))
      .filter((n) => !Number.isNaN(new Date(n.momentoISO).getTime()))
      .sort((a, b) => new Date(b.momentoISO).getTime() - new Date(a.momentoISO).getTime())
      .slice(0, 20);
  }, [processos, ehAdmin, user, nomeMilitarAtual]);

  const notificacoesChefia = useMemo(() => {
    if (!ehAdmin) return [] as NotificacaoItem[];

    return processos
      .filter((p) => p.status !== "concluido" && isPendenteChefia(p))
      .map((p) => ({
        id: p.id,
        titulo: `Processo ${p.numero}`,
        texto: p.descricao || "Processo pendente de validacao da chefia.",
        momentoISO: p.atualizadoEm || p.criadoEm,
      }))
      .sort((a, b) => new Date(b.momentoISO).getTime() - new Date(a.momentoISO).getTime())
      .slice(0, 20);
  }, [processos, ehAdmin]);

  const notificacoesBase = ehAdmin ? notificacoesChefia : notificacoesAssessor;

  const listaNotificacoes = useMemo(() => {
    return [...notificacoesBase, ...notificacoesCalendario]
      .sort((a, b) => new Date(b.momentoISO).getTime() - new Date(a.momentoISO).getTime())
      .slice(0, 30);
  }, [notificacoesBase, notificacoesCalendario]);

  const contadorSino = useMemo(() => {
    return listaNotificacoes.filter(
      (n) => new Date(n.momentoISO).getTime() > ultimoAcessoNotificacoes,
    ).length;
  }, [listaNotificacoes, ultimoAcessoNotificacoes]);

  const abrirFecharNotificacoes = () => {
    const abrindo = !notificacoesOpen;
    setNotificacoesOpen(abrindo);

    if (abrindo && chaveNotificacoes) {
      const agora = Date.now();
      setUltimoAcessoNotificacoes(agora);
      try {
        window.localStorage.setItem(chaveNotificacoes, String(agora));
      } catch {
        // sem persistencia, segue apenas em memoria
      }
    }
  };

  useEffect(() => {
    if (!notificacoesOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const alvo = event.target as Node | null;
      if (!notificacoesRef.current || !alvo) return;
      if (!notificacoesRef.current.contains(alvo)) {
        setNotificacoesOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [notificacoesOpen]);
  
  const handleEdit = (p: Processo) => {
    setEditing(p);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!perfilOpen || !user) return;
    setPerfilNome(user.nome || "");
    setPerfilNomeGuerra(user.nomeGuerra || "");
    setPerfilEmail(user.email || "");
    setPerfilTelefone(user.telefone || "");
    setPerfilSenha("");
    setPerfilSenhaConfirmacao("");
  }, [perfilOpen, user]);

  const handleSalvarPerfil = async () => {
    if (!user) {
      toast.error("Sessao invalida. Faca login novamente.");
      return;
    }

    const nome = perfilNome.trim();
    const nomeGuerra = perfilNomeGuerra.trim();
    const email = perfilEmail.trim().toLowerCase();
    const telefone = perfilTelefone.trim();
    const senha = perfilSenha;
    const senhaConfirmacao = perfilSenhaConfirmacao;

    if (!nome || !email) {
      toast.error("Informe nome e e-mail.");
      return;
    }

    if (senha && senha.length < 6) {
      toast.error("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (senha !== senhaConfirmacao) {
      toast.error("A confirmacao da senha nao confere.");
      return;
    }

    setPerfilSaving(true);
    try {
      const [{ auth, db }, authSdk, fsSdk] = await Promise.all([
        import("@/lib/firebase"),
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);

      const atual = auth.currentUser;
      if (!atual) throw new Error("Sessao nao encontrada");

      const emailAtual = (atual.email || user.email || "").trim().toLowerCase();

      if (email !== emailAtual) {
        await authSdk.updateEmail(atual, email);
      }

      if (senha) {
        await authSdk.updatePassword(atual, senha);
      }

      const nomeExibicao = (nomeGuerra || nome).trim();
      await authSdk.updateProfile(atual, { displayName: nomeExibicao });

      // Tenta sincronizar na coleção usuarios (quando permitido pelas regras)
      try {
        const usuariosRef = fsSdk.collection(db, "usuarios");
        const qUid = fsSdk.query(usuariosRef, fsSdk.where("uid", "==", atual.uid));
        const snapUid = await fsSdk.getDocs(qUid);

        if (!snapUid.empty) {
          await fsSdk.updateDoc(snapUid.docs[0].ref, {
            nome,
            nomeGuerra,
            email,
            telefone,
            atualizadoEm: new Date().toISOString(),
          });
        } else {
          const qEmail = fsSdk.query(usuariosRef, fsSdk.where("email", "==", emailAtual));
          const snapEmail = await fsSdk.getDocs(qEmail);
          if (!snapEmail.empty) {
            await fsSdk.updateDoc(snapEmail.docs[0].ref, {
              nome,
              nomeGuerra,
              email,
              telefone,
              atualizadoEm: new Date().toISOString(),
            });
          }
        }
      } catch (error: any) {
        if (error?.code === "permission-denied") {
          toast.info("Senha/e-mail atualizados. Perfil no Firestore sera sincronizado pela administracao.");
        } else {
          console.warn("Falha ao sincronizar perfil no Firestore:", error);
        }
      }

      // Mantém cache local alinhado para a UI após reload/sessão
      try {
        const cachedRaw = window.localStorage.getItem("assjur:auth");
        const cached = cachedRaw ? JSON.parse(cachedRaw) : {};
        const atualizado = {
          ...cached,
          ...user,
          nome,
          nomeGuerra: nomeGuerra || undefined,
          email,
          telefone: telefone || undefined,
        };
        window.localStorage.setItem("assjur:auth", JSON.stringify(atualizado));
      } catch {
        // sem cache local
      }

      setPerfilOpen(false);
      toast.success("Perfil atualizado com sucesso!");
      window.location.reload();
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error);
      if (error?.code === "auth/requires-recent-login") {
        toast.error("Para alterar e-mail ou senha, entre novamente no sistema e tente outra vez.");
      } else if (error?.code === "auth/email-already-in-use") {
        toast.error("Este e-mail ja esta em uso.");
      } else {
        toast.error("Nao foi possivel atualizar seu perfil.");
      }
    } finally {
      setPerfilSaving(false);
    }
  };

  const handleAdd = (status: StatusProcesso) => {
    setEditing(null);
    setDefaultStatus(status);
    setDialogOpen(true);
  };

  const handleNovoLancamentoCalendario = (payload: { id: string; titulo: string; descricao?: string; criadoEm: string }) => {
    if (!chaveNotificacoesCalendario) return;

    const item: NotificacaoItem = {
      id: `cal-${payload.id}`,
      titulo: "Novo lançamento no calendário",
      texto: payload.descricao?.trim() ? `${payload.titulo} - ${payload.descricao}` : payload.titulo,
      momentoISO: payload.criadoEm,
    };

    setNotificacoesCalendario((prev) => {
      const next = [item, ...prev].slice(0, 40);
      try {
        window.localStorage.setItem(chaveNotificacoesCalendario, JSON.stringify(next));
      } catch {
        // sem persistencia local
      }
      return next;
    });
  };

  const handleSave = (dados: Omit<Processo, "id" | "criadoEm">) => {
    if (editing) atualizar(editing.id, dados);
    else criar(dados);
  };

  const registrarMovimentacao = async (processoId: string, texto: string) => {
    const { db } = await import("@/lib/firebase");
    const { collection, addDoc, doc, getDoc, setDoc, Timestamp } = await import("firebase/firestore");

    const agoraISO = new Date().toISOString();
    const autor = nomeMilitarAtual;
    const autorId = user?.uid || "sistema";

    const historicoRef = collection(db, `processos/${processoId}/historico`);
    await addDoc(historicoRef, {
      autor,
      autorId,
      texto,
      timestamp: Timestamp.now(),
    });

    const mensagensRef = doc(db, "mensagens", processoId);
    const mensagensSnap = await getDoc(mensagensRef);
    const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
    await setDoc(mensagensRef, {
      historico: [...historicoExistente, {
        id: crypto.randomUUID(),
        autor,
        autorId,
        texto,
        timestamp: agoraISO,
      }]
    });
  };

  const handleRedistribuir = async (processoId: string, novoResponsavel: string) => {
    try {
      const { db } = await import("@/lib/firebase");
      const { collection, addDoc, getDocs, query, updateDoc, where } = await import("firebase/firestore");
      
      const processo = processos.find((p) => p.id === processoId);
      if (!processo) {
        return;
      }
      
      const tinhaResponsavelAntes = !!processo.responsavel?.trim();
      const vaiParaAguardando = !novoResponsavel?.trim();

      const msgHistorico = vaiParaAguardando
        ? "Processo retornado para Aguardando Distribuição"
        : tinhaResponsavelAntes
          ? `Processo redistribuído para ${novoResponsavel}`
          : `Processo distribuído para ${novoResponsavel}`;
      
      const agoraISO = new Date().toISOString();
      const autorNome = nomeMilitarAtual;
      
      // Atualiza o processo com responsável, data e autor
      const atualizarProcessoPromise = atualizar(processoId, {
        responsavel: novoResponsavel,
        descricao: msgHistorico,
        atualizadoEm: agoraISO,
        atualizadoPorNome: autorNome,
      });

      // Mantém a coleção de distribuições em sincronia com o responsável atual.
      // O board usa assessorNome dessa coleção para decidir a coluna de cada card.
      const distribuicoesRef = collection(db, "distribuicoes");
      const qDistrib = query(distribuicoesRef, where("processoId", "==", processoId));
      const sincronizarDistribuicaoPromise = (async () => {
        const distribSnapshot = await getDocs(qDistrib);

        if (distribSnapshot.empty) {
          await addDoc(distribuicoesRef, {
            processoId,
            assessorId: "manual",
            assessorNome: novoResponsavel,
            prazo: "",
            prioridade: "Normal",
            dataDistribuicao: agoraISO,
            atualizadoEm: agoraISO,
          });
        } else {
          const updates = distribSnapshot.docs.map((docSnap) =>
            updateDoc(docSnap.ref, {
              assessorNome: novoResponsavel,
              dataDistribuicao: agoraISO,
              atualizadoEm: agoraISO,
            })
          );
          await Promise.all(updates);
        }
      })();
      
      await atualizarProcessoPromise;
      Promise.all([sincronizarDistribuicaoPromise, registrarMovimentacao(processoId, msgHistorico)]).catch((error) => {
        console.error("❌ Erro em pós-processamento da redistribuição:", error);
      });
    } catch (error) {
      console.error("❌ Erro ao redistribuir processo:", error);
    }
  };

  const handleMoverStatus = async (processoId: string, novoStatus: StatusProcesso) => {
    try {
      const rotulosStatus: Record<StatusProcesso, string> = {
        novo: "Triagem",
        andamento: "Em Andamento",
        audiencia: "Audiência",
        recurso: "Recurso",
        concluido: "Concluído",
      };

      const msgHistorico = `Status alterado para ${rotulosStatus[novoStatus]}.`;
      await atualizar(processoId, {
        status: novoStatus,
        descricao: msgHistorico,
        atualizadoEm: new Date().toISOString(),
        atualizadoPorNome: nomeMilitarAtual,
      });
      Promise.resolve(registrarMovimentacao(processoId, msgHistorico)).catch((error) => {
        console.error("❌ Erro ao registrar histórico de status:", error);
      });
    } catch (error) {
      console.error("❌ Erro ao mover status:", error);
    }
  };

  // Sidebar nav
  const navMain: { id: Aba; label: string; icon: typeof LayoutGrid }[] = [
    { id: "mesa", label: "Painel de Controle", icon: LayoutGrid },
  ];

  const navSec: { id: Aba; label: string; icon: typeof LayoutGrid }[] = [
    { id: "prazos", label: "Controle de Prazos", icon: Calendar },
    ...(ehAdmin ? [{ id: "arquivo" as Aba, label: "Processos Antigos", icon: History }] : []),
  ];

  // Tabs principais (estilo AssJur)
  // Apenas ADMIN vê "Arquivo" e "Gestão da Equipe"
  // Assessores (DU ou PA) veem apenas: Mesa, Prazos e Indicadores
  // Aba "Arquivo / Encerrados" é específica de processos finalizados (gestão PA)
  const tabsCompletas: { id: Aba; label: string }[] = [
    { id: "mesa", label: "Mesa de Trabalho" },
    { id: "prazos", label: "Controle de Prazos" },
    { id: "arquivo", label: "Arquivo / Encerrados" },
    { id: "indicadores", label: "Indicadores de Gestão" },
    { id: "equipe", label: "Gestão da Equipe" },
  ];
  
  const tabsAssessor: { id: Aba; label: string }[] = [
    { id: "mesa", label: "Mesa de Trabalho" },
    { id: "prazos", label: "Controle de Prazos" },
    { id: "indicadores", label: "Indicadores de Gestão" },
  ];
  
  const tabs = ehAdmin ? tabsCompletas : tabsAssessor;

  useEffect(() => {
    if (!tabs.some((t) => t.id === aba)) {
      setAba("mesa");
    }
  }, [tabs, aba]);

  // Renderiza tela de carregamento enquanto a sessão não foi sincronizada
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
          <p className="text-sm font-medium text-slate-600">Sincronizando sessao...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ===================== SIDEBAR (estilo AssJur Flow) ===================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-sidebar text-sidebar-foreground transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative flex flex-col h-full">
          {/* Logo AssJur Flow */}
          <div className="px-5 py-6 flex items-start justify-between border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[oklch(0.6_0.16_230)] flex items-center justify-center shadow-lg shrink-0">
                <Scale className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight leading-none font-display text-white">
                  AssJur Flow
                </h1>
                <p className="text-[9px] text-[oklch(0.78_0.18_145)] mt-1 tracking-[0.2em] uppercase font-bold">
                  12ª Região Militar
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto scrollbar-thin">
            {navMain.map((item) => {
              const Icon = item.icon;
              const active = aba === "mesa";
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setAba(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-[var(--transition-smooth)] ${
                    active
                      ? "bg-[oklch(0.6_0.16_230)] text-white font-bold shadow-lg"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}

            {navSec.map((item) => {
              const Icon = item.icon;
              const active = aba === item.id;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setAba(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    active
                      ? "bg-[oklch(0.6_0.16_230)] text-white font-bold shadow-lg"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer com usuário (estilo AssJur) */}
          <div className="border-t border-sidebar-border p-3">
            <div className="flex items-center gap-3 px-2 py-2">
              <SoldierAvatar size={40} className="shadow-md rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white leading-tight truncate">
                  {usuario.posto} {usuario.nome}
                </p>
                <p className="text-[9px] text-[oklch(0.78_0.18_145)] tracking-wider uppercase font-bold truncate">
                  {usuario.role}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  title="Configurações"
                  onClick={() => setPerfilOpen(true)}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-white transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Sair"
                  onClick={() => {
                    logout();
                    navigate({ to: "/login" });
                  }}
                  className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-white transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===================== MAIN ===================== */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="px-4 sm:px-6 lg:px-8 pt-5">
          <div className="flex items-start sm:items-center gap-3 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9 shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-2xl sm:text-3xl tracking-tight leading-tight font-display text-foreground">
                Painel de Controle
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Mesa de trabalho e acompanhamento dos processos em andamento
              </p>
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className="relative" ref={notificacoesRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={abrirFecharNotificacoes}
                  className="relative h-10 w-10 rounded-full bg-card border border-border hover:bg-muted"
                  aria-label="Abrir notificacoes"
                >
                  <Bell className="h-4 w-4 text-foreground" />
                  {contadorSino > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
                      {contadorSino}
                    </span>
                  )}
                </Button>

                {notificacoesOpen && (
                  <div className="absolute right-0 mt-2 w-[340px] max-w-[90vw] rounded-2xl border border-border bg-card shadow-2xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border bg-muted/40">
                      <p className="text-sm font-bold text-foreground">Notificacoes</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ehAdmin
                          ? "Pendencias da chefia"
                          : "Ultimas movimentacoes novas dos seus processos"}
                      </p>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {listaNotificacoes.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                          Nenhuma notificacao no momento.
                        </div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {listaNotificacoes.map((n) => (
                            <li key={n.id} className="px-4 py-3">
                              <p className="text-xs font-semibold text-foreground">{n.titulo}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.texto}</p>
                              <p className="text-[11px] text-muted-foreground/80 mt-1">
                                {formatarDataHora(n.momentoISO)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={() => handleAdd("novo")}
                className="h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary-glow font-semibold px-4 shadow-md"
              >
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Novo Processo</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Tabs principais — estilo AssJur (underline laranja) */}
        <div className="px-4 sm:px-6 lg:px-8 mt-5 border-b border-border">
          <div className="flex gap-1 overflow-x-auto scrollbar-thin">
            {tabs.map((t) => {
              const active = aba === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setAba(t.id)}
                  className={`shrink-0 px-4 py-3 text-sm font-semibold relative transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-1 rounded-t-full bg-[oklch(0.7_0.17_50)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <main className="px-4 sm:px-6 lg:px-8 py-5 space-y-5 max-w-[1700px] mx-auto">
          {aba === "mesa" && (
            <>
              {/* Sub-controles: Minha Mesa | Visão do Setor | DU | PA + busca + filtros à direita */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-card border border-border rounded-full p-1 shrink-0">
                  <div className="px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider bg-foreground text-background">
                    Visão do Setor
                  </div>
                </div>

                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar processo, parte, assunto..."
                    className="pl-11 h-11 rounded-full bg-card border-border focus-visible:ring-accent text-sm"
                  />
                </div>

                {/* Filtros tipo à direita - APENAS ADMIN */}
                {ehAdmin && (
                  <div className="hidden sm:flex gap-1 shrink-0">
                    <button
                      onClick={() => setFiltroTipo("todos")}
                      className={`px-4 h-11 rounded-full text-[12px] font-bold transition-all border ${
                        filtroTipo === "todos"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setFiltroTipo("DU")}
                      className={`px-4 h-11 rounded-full text-[12px] font-bold transition-all border ${
                        filtroTipo === "DU"
                          ? "bg-[var(--tipo-du-bg)] text-[var(--tipo-du)] border-[var(--tipo-du)]/40"
                          : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                      }`}
                    >
                      DU
                    </button>
                    <button
                      onClick={() => setFiltroTipo("PA")}
                      className={`px-4 h-11 rounded-full text-[12px] font-bold transition-all border ${
                        filtroTipo === "PA"
                          ? "bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] border-[var(--tipo-pa)]/40"
                          : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                      }`}
                    >
                    PA
                    </button>
                  </div>
                )}
              </div>

              <Dashboard
                processos={processosParaDashboard}
                filtro={filtro}
                onFiltroChange={setFiltro}
              />

              {filtro !== "todos" && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Filtro de prazo:</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground font-bold border border-accent">
                    {filtro === "vencidos" && "Vencidos"}
                    {filtro === "hoje" && "Vencem hoje"}
                    {filtro === "semana" && "Próximos 7 dias"}
                    <button
                      onClick={() => setFiltro("todos")}
                      className="hover:bg-foreground/10 rounded-full p-0.5 -mr-1"
                      aria-label="Limpar filtro"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                </div>
              )}

              <MesaTrabalho
                processos={filtrados}
                filtroTipo={filtroTipo}
                onEdit={handleEdit}
                onDelete={remover}
                onMove={handleMoverStatus}
                onRedistribuir={handleRedistribuir}
                usuario={user || undefined}
                ehAdmin={ehAdmin}
                unreadProcessIds={processosNaoLidosIds}
                onReadProcess={marcarProcessoComoLido}
              />
            </>
          )}

          {aba === "prazos" && (
            <Suspense fallback={<TabLoading label="Carregando controle de prazos..." />}>
              <CalendarioPrazos
                processos={processosParaDashboard}
                usuario={usuario}
                onNovoLancamento={handleNovoLancamentoCalendario}
              />
            </Suspense>
          )}

          {aba === "arquivo" && (
            <EmptyTab
              icon={FolderArchive}
              title="Arquivo / Encerrados"
              description="Histórico de processos finalizados e arquivados."
              processos={(() => {
                const finalizados = processos.filter((p) => p.status === "concluido");
                console.log(`📁 Aba Arquivo: ${finalizados.length} processos finalizados de ${processos.length} totais`);
                return finalizados;
              })()}
              onEdit={handleEdit}
              onDelete={remover}
              onMove={handleMoverStatus}
            />
          )}

          {aba === "indicadores" && (
            <Suspense fallback={<TabLoading label="Carregando indicadores..." />}>
              <Estatisticas processos={processosParaDashboard} />
            </Suspense>
          )}

          {aba === "equipe" && (
            <Suspense fallback={<TabLoading label="Carregando gestão da equipe..." />}>
              <GestaoEquipe />
            </Suspense>
          )}
        </main>
      </div>

      {dialogOpen && (
        <Suspense fallback={null}>
          <CadastroProcessoModal
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            processo={editing}
            onSuccess={() => {
              setDialogOpen(false);
              setEditing(null);
            }}
          />
        </Suspense>
      )}

      <Dialog open={perfilOpen} onOpenChange={setPerfilOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Meu Perfil</DialogTitle>
            <DialogDescription>
              Atualize seus dados e, se desejar, altere sua senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="perfil-nome">Nome</Label>
              <Input
                id="perfil-nome"
                value={perfilNome}
                onChange={(e) => setPerfilNome(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perfil-nome-guerra">Nome de Guerra</Label>
              <Input
                id="perfil-nome-guerra"
                value={perfilNomeGuerra}
                onChange={(e) => setPerfilNomeGuerra(e.target.value)}
                placeholder="Ex: Becker"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="perfil-email">E-mail</Label>
                <Input
                  id="perfil-email"
                  type="email"
                  value={perfilEmail}
                  onChange={(e) => setPerfilEmail(e.target.value)}
                  placeholder="usuario@dominio.mil.br"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-telefone">Telefone</Label>
                <Input
                  id="perfil-telefone"
                  value={perfilTelefone}
                  onChange={(e) => setPerfilTelefone(e.target.value)}
                  placeholder="(92) 99999-9999"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="perfil-senha">Nova Senha</Label>
                <Input
                  id="perfil-senha"
                  type="password"
                  value={perfilSenha}
                  onChange={(e) => setPerfilSenha(e.target.value)}
                  placeholder="Deixe em branco para manter"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perfil-senha-2">Confirmar Nova Senha</Label>
                <Input
                  id="perfil-senha-2"
                  type="password"
                  value={perfilSenhaConfirmacao}
                  onChange={(e) => setPerfilSenhaConfirmacao(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerfilOpen(false)} disabled={perfilSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarPerfil} disabled={perfilSaving}>
              {perfilSaving ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabLoading({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-6 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function EmptyTab({
  icon: Icon,
  title,
  description,
  processos,
  onEdit,
  onDelete,
  onMove,
}: {
  icon: typeof LayoutGrid;
  title: string;
  description: string;
  processos?: Processo[];
  onEdit?: (p: Processo) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, status: StatusProcesso) => void;
}) {
  if (processos && processos.length > 0 && onEdit && onDelete && onMove) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center gap-3 mb-1">
            <span className="inline-flex h-10 w-10 rounded-xl bg-accent/40 items-center justify-center">
              <Icon className="h-5 w-5 text-accent-foreground" />
            </span>
            <div>
              <h3 className="font-bold text-lg text-foreground font-display">{title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>
        <Suspense fallback={<TabLoading label="Carregando quadro de processos..." />}>
          <KanbanBoard
            processos={processos}
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
            onAdd={() => {}}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-card border-2 border-dashed border-border p-12 text-center">
      <span className="inline-flex h-14 w-14 rounded-2xl bg-accent/40 items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-accent-foreground" />
      </span>
      <h3 className="font-bold text-xl text-foreground font-display mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      <p className="text-xs text-muted-foreground/60 mt-4 italic">
        Em desenvolvimento — disponível em breve.
      </p>
    </div>
  );
}
