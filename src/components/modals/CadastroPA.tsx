import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { Processo } from "@/types/processo";
import { collection, addDoc, updateDoc, doc, Timestamp, setDoc, getDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { calcularFaixasProrrogacaoPA, calcularPrazoFinalPA } from "@/lib/prazo";
import {
  DEFAULT_ASSUNTOS_PA_SINDICANCIA,
  normalizarAssuntosPA,
  type SiteSettings,
} from "@/types/siteSettings";

interface CadastroPAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo?: Processo | null;
  onSuccess?: () => void;
  siteSettings?: SiteSettings;
}

type ProrrogacaoEditavel = {
  dias: number;
  doc: string;
  inicio: string;
  fim: string;
  em?: string;
  por?: string;
};

const TIPOS_PA = ["IPM", "Sindicância", "Conselho de Disciplina", "Conselho de Justificação", "Investigação Preliminar", "Outros"];
const POSTOS_CONSELHO = ["Cap", "Maj", "TC", "Cel"];
const POSTOS_ENCARREGADO = ["Sgt", "Ten", "Cap", "Maj", "TC", "Cel"];

const sanitizarPayload = (obj: unknown): unknown => {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizarPayload);
  if (typeof obj === "object") {
    const proto = Object.getPrototypeOf(obj);
    if (proto && proto !== Object.prototype) return obj;
    const result: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      result[key] = sanitizarPayload((obj as Record<string, unknown>)[key]);
    }
    return result;
  }
  return obj;
};

const inferirSetorPorCampos = (...valores: Array<unknown>): "DU" | "PA" | "" => {
  const candidatos = valores
    .filter(Boolean)
    .map((valor) => String(valor).toUpperCase());

  if (candidatos.some((valor) => valor.includes("DU") || valor.includes("DEFESA DE USU"))) {
    return "DU";
  }
  if (candidatos.some((valor) => valor.includes("PA") || valor.includes("PROCESSOS ADMIN"))) {
    return "PA";
  }
  return "";
};

const toDataCivil = (valor: string): string => {
  const texto = (valor || "").trim();
  const prefixo = texto.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return prefixo || "";
};

const somarDias = (dataISO: string, dias: number): string => {
  const base = toDataCivil(dataISO);
  if (!base) return "";
  const data = new Date(`${base}T00:00:00`);
  if (Number.isNaN(data.getTime())) return "";
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
};

const diferencaDias = (inicioISO: string, fimISO: string): number => {
  const inicio = toDataCivil(inicioISO);
  const fim = toDataCivil(fimISO);
  if (!inicio || !fim) return 0;
  const dataInicio = new Date(`${inicio}T00:00:00`);
  const dataFim = new Date(`${fim}T00:00:00`);
  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) return 0;
  const msDia = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((dataFim.getTime() - dataInicio.getTime()) / msDia));
};

const isConselhoPA = (tipo: string) => tipo === "Conselho de Disciplina" || tipo === "Conselho de Justificação";
const usaPortariaPA = (tipo: string) => {
  const norm = tipo.toLowerCase();
  return norm.includes("ipm") || norm.includes("sindic") || norm.includes("conselho");
};
const aceitaDiligencia = (tipo: string) => {
  const norm = tipo.toLowerCase();
  return norm.includes("ipm") || norm.includes("sindic");
};
const formatarPortaria = (valor: string) => {
  const texto = valor.trim();
  if (!texto) return "";
  return /^portaria/i.test(texto) ? texto : `Portaria Nr ${texto}`;
};

export function CadastroPA({ open, onOpenChange, processo, onSuccess, siteSettings }: CadastroPAProps) {
  const { user } = useAuth();
  const ehAdminOuChefe = isAdmin(user);

  const assuntosPASindicancia = useMemo(
    () => normalizarAssuntosPA(siteSettings?.assuntosPASindicancia, DEFAULT_ASSUNTOS_PA_SINDICANCIA),
    [siteSettings?.assuntosPASindicancia],
  );

  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [parte, setParte] = useState("");
  const [assunto, setAssunto] = useState("");
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  const [tipoPA, setTipoPA] = useState("");
  // V4.7: campo legado `fluxoIPM` removido. Todo PA novo nasce na fase
  // FAZENDO_PORTARIA do motor V4 (situacaoFluxoPA).
  const [anoLegado, setAnoLegado] = useState("");
  const [postoEncarregado, setPostoEncarregado] = useState("");
  const [nomeEncarregado, setNomeEncarregado] = useState("");
  const [mudouEncarregado, setMudouEncarregado] = useState(false);
  const [postoEncarregadoAtual, setPostoEncarregadoAtual] = useState("");
  const [nomeEncarregadoAtual, setNomeEncarregadoAtual] = useState("");
  const [novaPortaria, setNovaPortaria] = useState("");
  const [assuntoSindicancia, setAssuntoSindicancia] = useState("");
  const [especificidadesSindicancia, setEspecificidadesSindicancia] = useState("");
  const [omPresidenteConselho, setOmPresidenteConselho] = useState("");
  const [prorrogacoesEditaveis, setProrrogacoesEditaveis] = useState<ProrrogacaoEditavel[]>([]);
  const [dataInicioPrazoPA, setDataInicioPrazoPA] = useState("");

  const [loading, setLoading] = useState(false);

  const anosLegado = Array.from({ length: 4 }, (_, idx) => new Date().getFullYear() - 4 + idx);

  const resetForm = () => {
    setNumeroProcesso("");
    setParte("");
    setAssunto("");
    setDataEntrada(new Date().toISOString().split("T")[0]);
    setObservacoes("");
    setTipoPA("");
    setAnoLegado("");
    setPostoEncarregado("");
    setNomeEncarregado("");
    setMudouEncarregado(false);
    setPostoEncarregadoAtual("");
    setNomeEncarregadoAtual("");
    setNovaPortaria("");
    setAssuntoSindicancia("");
    setEspecificidadesSindicancia("");
    setOmPresidenteConselho("");
    setProrrogacoesEditaveis([]);
    setDataInicioPrazoPA("");
  };

  const preencherParaEdicao = (p: Processo) => {
    setNumeroProcesso(p.numero || "");
    setParte(p.cliente || "");
    setAssunto(p.tipoAcao || "");
    setDataEntrada(p.dataEntrada || new Date().toISOString().split("T")[0]);
    setObservacoes(p.observacoes || "");

    setTipoPA(p.tipoPA || "");
    const conselhoPA = p.tipoPA === "Conselho de Disciplina" || p.tipoPA === "Conselho de Justificação";

    if (p.encarregado) {
      const partes = p.encarregado.split(" ");
      if (partes.length > 1) {
        setPostoEncarregado(partes[0]);
        setNomeEncarregado(partes.slice(1).join(" "));
      } else {
        setNomeEncarregado(p.encarregado);
      }
    }

    if (conselhoPA) {
      if (p.presidenteConselhoPosto) setPostoEncarregado(p.presidenteConselhoPosto);
      if (p.presidenteConselhoNome) setNomeEncarregado(p.presidenteConselhoNome);
      setOmPresidenteConselho(p.omPresidenteConselho || "");
    }

    if (p.tipoPA === "Sindicância" && p.tipoAcao) {
      const partes = p.tipoAcao.split(" - ");
      if (partes.length > 1) {
        setAssuntoSindicancia(partes[0]);
        setEspecificidadesSindicancia(partes.slice(1).join(" - "));
      }
    }

    const faixasProrrogacao = calcularFaixasProrrogacaoPA({
      tipoPA: p.tipoPA,
      dataInicioPrazo: p.dataInicioPrazo,
      dataAssinatura: p.dataAssinatura,
      prorrogacoes: p.prorrogacoes,
    });

    const listaEditavel = faixasProrrogacao.map((faixa, index) => ({
      dias: faixa.dias,
      doc: p.prorrogacoes?.[index]?.doc || "",
      inicio: faixa.inicio,
      fim: faixa.fim,
      em: p.prorrogacoes?.[index]?.em,
      por: p.prorrogacoes?.[index]?.por,
    }));

    setProrrogacoesEditaveis(listaEditavel);
    setDataInicioPrazoPA(p.dataInicioPrazo || "");
  };

  useEffect(() => {
    if (!open) {
      setTimeout(resetForm, 300);
    } else if (processo) {
      preencherParaEdicao(processo);
    } else {
      resetForm();
    }
  }, [open, processo]);

  const recalcularProrrogacoesComBase = (inicioPrazoBase: string, itens: ProrrogacaoEditavel[]) => {
    const dataBase = toDataCivil(inicioPrazoBase);
    if (!dataBase || itens.length === 0) return itens;

    const faixas = calcularFaixasProrrogacaoPA({
      tipoPA,
      dataInicioPrazo: dataBase,
      dataAssinatura: processo?.dataAssinatura,
      prorrogacoes: itens.map((item) => ({
        dias: Math.max(0, Math.trunc(Number(item.dias) || 0)),
        inicio: toDataCivil(item.inicio) || undefined,
        fim: toDataCivil(item.fim) || undefined,
      })),
    });

    return itens.map((item, index) => ({
      ...item,
      dias: faixas[index]?.dias ?? item.dias,
      inicio: faixas[index]?.inicio ?? item.inicio,
      fim: faixas[index]?.fim ?? item.fim,
    }));
  };

  useEffect(() => {
    if (!processo?.id) return;
    if (!toDataCivil(dataInicioPrazoPA)) return;
    setProrrogacoesEditaveis((atual) => recalcularProrrogacoesComBase(dataInicioPrazoPA, atual));
  }, [dataInicioPrazoPA, processo?.id, tipoPA]);

  const atualizarProrrogacao = (index: number, campo: "doc" | "dias" | "inicio" | "fim", valor: string) => {
    setProrrogacoesEditaveis((atual) => {
      const copia = [...atual];
      const item = { ...copia[index] };

      if (campo === "doc") item.doc = valor;

      if (campo === "dias") {
        const dias = Math.max(0, Math.trunc(Number(valor) || 0));
        item.dias = dias;
        if (toDataCivil(item.inicio)) item.fim = somarDias(item.inicio, dias);
      }

      if (campo === "inicio") {
        item.inicio = toDataCivil(valor);
        if (item.inicio) item.fim = somarDias(item.inicio, item.dias || 0);
      }

      if (campo === "fim") {
        item.fim = toDataCivil(valor);
        if (toDataCivil(item.inicio) && toDataCivil(item.fim)) {
          item.dias = diferencaDias(item.inicio, item.fim);
        }
      }

      copia[index] = item;
      return copia;
    });
  };

  const adicionarProrrogacaoEditavel = () => {
    setProrrogacoesEditaveis((atual) => {
      const ultimaFim = atual.length > 0 ? toDataCivil(atual[atual.length - 1].fim) : "";
      return [
        ...atual,
        {
          dias: 20,
          doc: "",
          inicio: ultimaFim,
          fim: ultimaFim ? somarDias(ultimaFim, 20) : "",
        },
      ];
    });
  };

  const removerProrrogacaoEditavel = (index: number) => {
    setProrrogacoesEditaveis((atual) => atual.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!numeroProcesso.trim()) {
      toast.error("Informe o número do processo.");
      return;
    }
    if (!parte.trim()) {
      toast.error("Informe a parte.");
      return;
    }
    if (!tipoPA) {
      toast.error("Selecione o tipo de procedimento do PA.");
      return;
    }

    const isSindicanciaPA = tipoPA === "Sindicância";
    const isConselhoPASelecionado = isConselhoPA(tipoPA);
    // V4.7: diligência/legado não existem mais como fluxo paralelo no cadastro.
    const isDiligenciaPA = false;
    const isSindicanciaAntiga = false;

    if (isSindicanciaPA && !assuntoSindicancia) {
      toast.error("Selecione o assunto da Sindicância.");
      return;
    }
    if (isSindicanciaPA && !especificidadesSindicancia.trim()) {
      toast.error("Preencha as especificidades do assunto da Sindicância.");
      return;
    }
    if (isDiligenciaPA && !postoEncarregado) {
      toast.error("Informe o encarregado da 1ª portaria para a diligência.");
      return;
    }
    if (isDiligenciaPA && mudouEncarregado && !postoEncarregadoAtual) {
      toast.error("Informe o encarregado atual quando houver mudança.");
      return;
    }
    if (isDiligenciaPA && mudouEncarregado && !novaPortaria.trim()) {
      toast.error("Informe a nova portaria quando houver mudança de encarregado.");
      return;
    }
    if (isSindicanciaAntiga && !anoLegado) {
      toast.error("Selecione o ano da Sindicância Antiga.");
      return;
    }
    if (isConselhoPASelecionado && !postoEncarregado) {
      toast.error("Selecione o posto do Presidente do Conselho.");
      return;
    }
    if (isConselhoPASelecionado && !nomeEncarregado.trim()) {
      toast.error("Informe o nome do Presidente do Conselho.");
      return;
    }
    if (isConselhoPASelecionado && !omPresidenteConselho.trim()) {
      toast.error("Informe a OM do Presidente do Conselho.");
      return;
    }

    if (!processo?.id) {
      if (!user?.uid || !user?.email) {
        toast.error("Sessão inválida. Faça login novamente antes de cadastrar o processo.");
        return;
      }

      const perfilCanonicoRef = doc(db, "usuarios", user.uid);
      const perfilCanonicoSnap = await getDoc(perfilCanonicoRef);

      if (!perfilCanonicoSnap.exists()) {
        toast.error("Seu perfil no Firestore não está sincronizado com o UID de acesso. Abra Gestão de Equipe e salve o cadastro deste usuário novamente.");
        return;
      }

      const perfilCanonico = perfilCanonicoSnap.data();
      const setorPerfilCanonico = inferirSetorPorCampos(
        perfilCanonico.setor,
        perfilCanonico.role,
        perfilCanonico.secao,
        perfilCanonico.cargo,
      );

      if (!ehAdminOuChefe && setorPerfilCanonico && setorPerfilCanonico !== "PA") {
        toast.error("Seu perfil no Firestore não está vinculado ao setor PA.");
        return;
      }
    }

    setLoading(true);

    try {
      const agora = Timestamp.now();
      const agoraISO = new Date().toISOString();
      const nomeBaseAutor = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
      const autorCadastro = user?.posto ? `${user.posto} ${nomeBaseAutor}`.trim() : nomeBaseAutor;
      const autorIdCadastro = user?.uid || "sistema";
      const autorEmailCadastro = user?.email || null;

      const assuntoFinal = isSindicanciaPA
        ? `${assuntoSindicancia.trim()}${especificidadesSindicancia.trim() ? ` - ${especificidadesSindicancia.trim()}` : ""}`
        : assunto.trim();

      const valorBasePortaria = isSindicanciaAntiga && anoLegado ? `${numeroProcesso}/${anoLegado}` : numeroProcesso;
      const primeiraPortariaFormatada = usaPortariaPA(tipoPA)
        ? formatarPortaria(valorBasePortaria)
        : numeroProcesso;
      const numeroFinal = (mudouEncarregado && novaPortaria) ? formatarPortaria(novaPortaria) : primeiraPortariaFormatada;

      // Verificação de duplicidade PA
      if (numeroFinal.trim()) {
        const q = query(
          collection(db, "processos"),
          where("numeroProcesso", "==", numeroFinal.trim())
        );
        const querySnapshot = await getDocs(q);

        let isDuplicate = false;
        querySnapshot.forEach((docSnap) => {
          if (!processo?.id || docSnap.id !== processo.id) {
            isDuplicate = true;
          }
        });

        if (isDuplicate) {
          toast.error(`Já existe um processo cadastrado com o número ${numeroFinal.trim()}.`);
          setLoading(false);
          return;
        }
      }

      const encarregadoPrimeiro = `${postoEncarregado} ${nomeEncarregado}`.trim() || null;
      const encarregadoAtualInformado = `${postoEncarregadoAtual} ${nomeEncarregadoAtual}`.trim() || null;
      const encarregadoPresidente = `${postoEncarregado} ${nomeEncarregado}`.trim() || null;
      const encarregadoFinal = isConselhoPASelecionado
        ? encarregadoPresidente
        : ((isDiligenciaPA && mudouEncarregado) ? encarregadoAtualInformado : encarregadoPrimeiro);

      // V4.7: payload sanitizado. Removidos campos legados (status, fluxoIPM,
      // emDiligencia, aguardandoAssinaturaCmt). O motor V4 (situacaoFluxoPA)
      // é injetado apenas na criação; updates não tocam no estado do fluxo.
      const dados: Record<string, unknown> = {
        numeroProcesso: numeroFinal.trim(),
        parte: parte.trim(),
        assunto: assuntoFinal,
        dataEntrada,
        observacoes: observacoes.trim() || null,
        setor: "PA",
        criadoEm: processo?.id ? undefined : agora,
        atualizadoEm: agora,
        userId: user!.uid,
        userEmail: user!.email,
        criadoPorNome: autorCadastro,
        criadoPorUid: autorIdCadastro,
        criadoPorEmail: autorEmailCadastro,

        tipoPA,
        encarregado: encarregadoFinal,
      };

      if (!processo?.id) {
        // V5.2 — payload inicial conforme o motor do tipoPA.
        //   • Investigação Preliminar / Outros → motor IP (ping-pong).
        //   • Conselho de Disciplina/Justificação → motor Conselho.
        //   • Demais (IPM, Sindicância) → motor PA padrão.
        const tNorm = tipoPA.trim().toLowerCase();
        const ehIPouOutros =
          tNorm === "investigação preliminar"
          || tNorm === "investigacao preliminar"
          || tNorm === "outros";
        if (ehIPouOutros) {
          dados.situacaoFluxoIP = "MESA_ASSESSOR";
        } else if (isConselhoPASelecionado) {
          dados.situacaoFluxoConselho = "FAZENDO_PORTARIA";
        } else {
          dados.situacaoFluxoPA = "FAZENDO_PORTARIA";
        }
        dados.finalizado = false;
      }

      if (isSindicanciaPA) {
        dados.assuntoSindicancia = assuntoSindicancia;
        dados.especificidadesAssunto = especificidadesSindicancia;
      }

      if (isDiligenciaPA) {
        dados.primeiraPortaria = primeiraPortariaFormatada;
        dados.primeiroEncarregado = encarregadoPrimeiro;
        dados.mudouEncarregadoDiligencia = mudouEncarregado ? "Sim" : "Não";
        if (mudouEncarregado) dados.novaPortariaDiligencia = numeroFinal;
      }

      if (isConselhoPASelecionado) {
        dados.presidenteConselhoPosto = postoEncarregado;
        dados.presidenteConselhoNome = nomeEncarregado.trim();
        dados.omPresidenteConselho = omPresidenteConselho.trim();
      }

      if (processo?.id) {
        const dataInicioPAEditada = toDataCivil(dataInicioPrazoPA) || toDataCivil(processo.dataInicioPrazo || "");
        if (dataInicioPAEditada) {
          dados.dataInicioPrazo = dataInicioPAEditada;
        }

        const prorrogacoesBase = prorrogacoesEditaveis.map((item) => ({
          dias: Math.max(0, Math.trunc(Number(item.dias) || 0)),
          doc: (item.doc || "").trim() || "Documento não informado",
          inicio: toDataCivil(item.inicio) || undefined,
          fim: toDataCivil(item.fim) || undefined,
          em: item.em || undefined,
          por: item.por || undefined,
        }));

        const faixasRecalculadas = dataInicioPAEditada
          ? calcularFaixasProrrogacaoPA({
              tipoPA,
              dataInicioPrazo: dataInicioPAEditada,
              dataAssinatura: processo.dataAssinatura,
              prorrogacoes: prorrogacoesBase,
            })
          : [];

        const prorrogacoesNormalizadas = prorrogacoesBase.map((item, index) => ({
          ...item,
          inicio: faixasRecalculadas[index]?.inicio || item.inicio,
          fim: faixasRecalculadas[index]?.fim || item.fim,
        }));

        dados.prorrogacoes = prorrogacoesNormalizadas;

        const prazoCalculado = calcularPrazoFinalPA({
          tipoPA,
          dataInicioPrazo: dataInicioPAEditada || processo.dataInicioPrazo,
          dataAssinatura: processo.dataAssinatura,
          prorrogacoes: prorrogacoesNormalizadas,
        });

        if (prazoCalculado) {
          dados.prazoFatal = prazoCalculado;
          dados.finalPrazo = prazoCalculado;
        }
      }

      if (processo?.id) {
        const processoRef = doc(db, "processos", processo.id);
        const msgAtualizacao = "Dados do processo atualizados.";

        const {
          criadoEm: _,
          userId: _uid,
          userEmail: _email,
          criadoPorUid: _cpUid,
          criadoPorEmail: _cpEmail,
          ...dadosUpdate
        } = dados;

        const payloadUpdate = sanitizarPayload({
          ...dadosUpdate,
          atualizadoEm: agora,
          atualizadoPorNome: autorCadastro,
          descricao: msgAtualizacao,
        });

        await updateDoc(processoRef, payloadUpdate as Record<string, unknown>);

        const historicoCol = collection(db, "processos", processo.id, "historico");
        await addDoc(historicoCol, {
          autor: autorCadastro,
          autorId: autorIdCadastro,
          texto: msgAtualizacao,
          timestamp: agoraISO,
        });

        const mensagensRef = doc(db, "mensagens", processo.id);
        const mensagensSnap = await getDoc(mensagensRef);
        const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
        await setDoc(mensagensRef, {
          historico: [
            ...historicoExistente,
            {
              id: crypto.randomUUID(),
              autor: autorCadastro,
              autorId: autorIdCadastro,
              texto: msgAtualizacao,
              timestamp: agoraISO,
            },
          ],
        });

        toast.success("Processo atualizado com sucesso!");
      } else {
        const msgCadastro = `Processo Cadastrado por ${autorCadastro}.`;
        dados.descricao = msgCadastro;

        const processoRef = await addDoc(collection(db, "processos"), sanitizarPayload(dados) as Record<string, unknown>);

        const historicoCol = collection(db, "processos", processoRef.id, "historico");
        await addDoc(historicoCol, {
          autor: autorCadastro,
          autorId: autorIdCadastro,
          texto: msgCadastro,
          timestamp: agoraISO,
        });

        await setDoc(doc(db, "mensagens", processoRef.id), {
          historico: [
            {
              id: crypto.randomUUID(),
              autor: autorCadastro,
              autorId: autorIdCadastro,
              texto: msgCadastro,
              timestamp: agoraISO,
            },
          ],
        });

        if (user) {
          await addDoc(collection(db, "distribuicoes"), {
            processoId: processoRef.id,
            assessorId: user.uid,
            assessorNome: autorCadastro,
            prazo: "",
            prioridade: "Normal",
            dataDistribuicao: agoraISO,
          });
        }

        toast.success(
          isSindicanciaAntiga ? "Sindicância antiga cadastrada no acervo!" : "PA Cadastrado e distribuído para a sua mesa!",
        );
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err?.code === "permission-denied") {
        toast.error("Sem permissão para criar processo. Verifique se o perfil deste usuário está salvo em /usuarios/{uid} com o setor correto.");
      } else {
        toast.error(`Erro ao salvar: ${err?.message || "Erro desconhecido"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // V5.3: bloco UI dependente de `fluxoIPM` removido (campo legado).
  const mostrarEncarregado = aceitaDiligencia(tipoPA);
  const mostrarPresidenteConselho = isConselhoPA(tipoPA);
  const mostrarAnoLegado = false;
  const mostrarMudancaEncarregado = false;
  const mostrarAssuntoSindicancia = tipoPA === "Sindicância";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{processo ? "Editar Processo PA" : "Cadastrar Processo PA"}</DialogTitle>
          <DialogDescription>
            {processo ? "Atualize as informações do processo PA." : "Preencha os dados para cadastrar um novo processo PA."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2 p-3 rounded-lg bg-purple-50 border border-purple-200">
            <Label htmlFor="tipoPA" className="uppercase text-xs font-bold text-purple-900">Tipo de Procedimento (PA) *</Label>
            <Select value={tipoPA} onValueChange={setTipoPA}>
              <SelectTrigger id="tipoPA">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PA.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* V4.7: bloco "Fluxo de Sindicância" removido (campo legado fluxoIPM). */}

          {mostrarAnoLegado && (
            <div className="space-y-2">
              <Label htmlFor="anoLegado">Ano da Sindicância Antiga *</Label>
              <Select value={anoLegado} onValueChange={setAnoLegado}>
                <SelectTrigger id="anoLegado">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {anosLegado.map((ano) => (
                    <SelectItem key={ano} value={String(ano)}>{ano}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numeroProcesso" className="uppercase text-xs font-semibold">Número da Portaria / Ano</Label>
              <Input id="numeroProcesso" value={numeroProcesso} onChange={(e) => setNumeroProcesso(e.target.value)} placeholder="Ex: Portaria Nr 12/2026" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parte" className="uppercase text-xs font-semibold">Parte / Interessado</Label>
              <Input id="parte" value={parte} onChange={(e) => setParte(e.target.value)} placeholder="Nome" />
            </div>
          </div>

          {mostrarAssuntoSindicancia ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="assuntoSindicancia">Assunto da Sindicância *</Label>
                <Select value={assuntoSindicancia} onValueChange={setAssuntoSindicancia}>
                  <SelectTrigger id="assuntoSindicancia">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assuntosPASindicancia.map((ass) => (
                      <SelectItem key={ass} value={ass}>{ass}</SelectItem>
                    ))}
                    {!!assuntoSindicancia && !assuntosPASindicancia.includes(assuntoSindicancia) && (
                      <SelectItem value={assuntoSindicancia}>{assuntoSindicancia}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="especificidades">Especificidades *</Label>
                <Textarea id="especificidades" value={especificidadesSindicancia} onChange={(e) => setEspecificidadesSindicancia(e.target.value)} rows={3} />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="assunto">Assunto *</Label>
              <Input id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Descreva o assunto do processo" />
            </div>
          )}

          {mostrarEncarregado && (
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
              <h4 className="font-semibold text-sm">Encarregado</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postoEncarregado">Posto *</Label>
                  <Select value={postoEncarregado} onValueChange={setPostoEncarregado}>
                    <SelectTrigger id="postoEncarregado"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {POSTOS_ENCARREGADO.map((posto) => (
                        <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeEncarregado">Nome *</Label>
                  <Input id="nomeEncarregado" value={nomeEncarregado} onChange={(e) => setNomeEncarregado(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {mostrarPresidenteConselho && (
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
              <h4 className="font-semibold text-sm">Presidente do Conselho</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postoPresidenteConselho">Posto *</Label>
                  <Select value={postoEncarregado} onValueChange={setPostoEncarregado}>
                    <SelectTrigger id="postoPresidenteConselho"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {POSTOS_CONSELHO.map((posto) => (
                        <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomePresidenteConselho">Nome *</Label>
                  <Input id="nomePresidenteConselho" value={nomeEncarregado} onChange={(e) => setNomeEncarregado(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="omPresidenteConselho">OM do Presidente *</Label>
                <Input id="omPresidenteConselho" value={omPresidenteConselho} onChange={(e) => setOmPresidenteConselho(e.target.value)} />
              </div>
            </div>
          )}

          {mostrarMudancaEncarregado && (
            <div className="space-y-4 p-4 border rounded-lg bg-amber-50">
              <div className="flex items-center space-x-2">
                <Checkbox id="mudouEncarregado" checked={mudouEncarregado} onCheckedChange={(checked) => setMudouEncarregado(checked as boolean)} />
                <Label htmlFor="mudouEncarregado" className="font-normal cursor-pointer">Houve mudança de encarregado?</Label>
              </div>

              {mudouEncarregado && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="postoEncarregadoAtual">Posto Atual *</Label>
                      <Select value={postoEncarregadoAtual} onValueChange={setPostoEncarregadoAtual}>
                        <SelectTrigger id="postoEncarregadoAtual"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {POSTOS_ENCARREGADO.map((posto) => (
                            <SelectItem key={posto} value={posto}>{posto}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nomeEncarregadoAtual">Nome Atual *</Label>
                      <Input id="nomeEncarregadoAtual" value={nomeEncarregadoAtual} onChange={(e) => setNomeEncarregadoAtual(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="novaPortaria">Nova Portaria *</Label>
                    <Input id="novaPortaria" value={novaPortaria} onChange={(e) => setNovaPortaria(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          )}

          {processo?.id && (
            <div className="space-y-2 p-4 border rounded-lg bg-sky-50 border-sky-200">
              <Label htmlFor="dataInicioPrazoPA" className="text-sm font-semibold text-sky-900">Data inicial da contagem do prazo</Label>
              <Input id="dataInicioPrazoPA" type="date" value={dataInicioPrazoPA} onChange={(e) => setDataInicioPrazoPA(e.target.value)} />
            </div>
          )}

          {processo?.id && (
            <div className="space-y-3 p-4 border rounded-lg bg-amber-50 border-amber-200">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-amber-900">Prorrogações (editar início e fim)</h4>
                <Button type="button" variant="outline" className="border-amber-300 text-amber-800" onClick={adicionarProrrogacaoEditavel}>+ Nova prorrogação</Button>
              </div>

              {prorrogacoesEditaveis.length === 0 ? (
                <p className="text-xs text-amber-800">Sem prorrogações registradas.</p>
              ) : (
                <div className="space-y-3">
                  {prorrogacoesEditaveis.map((item, index) => (
                    <div key={`prorrogacao-edit-${index}`} className="rounded-md border border-amber-200 bg-white p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Documento</Label>
                          <Input value={item.doc} onChange={(e) => atualizarProrrogacao(index, "doc", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Dias</Label>
                          <Input type="number" min={0} value={item.dias} onChange={(e) => atualizarProrrogacao(index, "dias", e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Início da prorrogação</Label>
                          <Input type="date" value={item.inicio} onChange={(e) => atualizarProrrogacao(index, "inicio", e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim da prorrogação</Label>
                          <Input type="date" value={item.fim} onChange={(e) => atualizarProrrogacao(index, "fim", e.target.value)} />
                        </div>
                        <div className="flex items-end">
                          <Button type="button" variant="outline" className="w-full border-red-300 text-red-700" onClick={() => removerProrrogacaoEditavel(index)}>Remover</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dataEntrada" className="uppercase text-xs font-semibold">Data de Entrada *</Label>
            <Input id="dataEntrada" type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="uppercase text-xs font-semibold">Observações / Informações Iniciais</Label>
            <Textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? "Salvando..." : (processo ? "Atualizar" : "Salvar Processo")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
