import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import type { Processo } from "@/types/processo";
import { collection, addDoc, updateDoc, doc, Timestamp, setDoc, getDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import {
  DEFAULT_ORIGENS_DU_DOCUMENTOS,
  DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
  DEFAULT_SECOES_DU,
  normalizarOrigensDUDocumentos,
  normalizarAssuntosDU,
  normalizarSecoesDU,
  type SiteSettings,
} from "@/types/siteSettings";

interface CadastroDUProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo?: Processo | null;
  onSuccess?: () => void;
  siteSettings?: SiteSettings;
}

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

export function CadastroDU({ open, onOpenChange, processo, onSuccess, siteSettings }: CadastroDUProps) {
  const { user } = useAuth();
  const ehAdminOuChefe = isAdmin(user);

  const assuntosDUPrincipais = useMemo(
    () => normalizarAssuntosDU(siteSettings?.assuntosDUPrincipais, DEFAULT_ASSUNTOS_DU_PRINCIPAIS),
    [siteSettings?.assuntosDUPrincipais],
  );
  const origensDUDocumentos = useMemo(
    () => normalizarOrigensDUDocumentos(siteSettings?.origensDUDocumentos, DEFAULT_ORIGENS_DU_DOCUMENTOS),
    [siteSettings?.origensDUDocumentos],
  );
  const secoesDU = useMemo(
    () => normalizarSecoesDU(siteSettings?.secoesDU, DEFAULT_SECOES_DU),
    [siteSettings?.secoesDU],
  );

  const [numeroProcesso, setNumeroProcesso] = useState("");
  const [parte, setParte] = useState("");
  const [assunto, setAssunto] = useState("");
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  const [origemDU, setOrigemDU] = useState("");
  const [secaoDU, setSecaoDU] = useState("SVP");
  const [isMS, setIsMS] = useState(false);
  const [prazoInternoDU, setPrazoInternoDU] = useState("");
  const [prazoFatalDU, setPrazoFatalDU] = useState("");
  const [duDataPrazoFluxo, setDuDataPrazoFluxo] = useState("");
  const [duNumeroSaida, setDuNumeroSaida] = useState("");
  const [duNumeroRecebido, setDuNumeroRecebido] = useState("");
  const [duNumeroDocFinal, setDuNumeroDocFinal] = useState("");

  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setNumeroProcesso("");
    setParte("");
    setAssunto("");
    setDataEntrada(new Date().toISOString().split("T")[0]);
    setObservacoes("");
    setOrigemDU("");
    setSecaoDU("SVP");
    setIsMS(false);
    setPrazoInternoDU("");
    setPrazoFatalDU("");
    setDuDataPrazoFluxo("");
    setDuNumeroSaida("");
    setDuNumeroRecebido("");
    setDuNumeroDocFinal("");
  };

  const preencherParaEdicao = (p: Processo) => {
    setNumeroProcesso(p.numero || "");
    setParte(p.cliente || "");
    setAssunto(p.tipoAcao || "");
    setDataEntrada(p.dataEntrada || new Date().toISOString().split("T")[0]);
    setObservacoes(p.observacoes || "");

    setOrigemDU(p.origemDU || "");
    setSecaoDU(p.secaoDU || "SVP");
    setIsMS(p.isMS || false);
    setPrazoInternoDU(p.prazo || "");
    setPrazoFatalDU(p.prazoFatal || "");

    const pedido = p.pedidoSubsidios || {};
    const resposta = p.respostaDU || {};
    setDuDataPrazoFluxo(pedido.dataPrazo || pedido.prazoResposta || "");
    setDuNumeroSaida(pedido.numeroSaida || pedido.numeroDiex || resposta.numeroDiex || "");
    setDuNumeroRecebido(pedido.numeroRecebido || resposta.numeroRecebido || "");
    setDuNumeroDocFinal(pedido.numeroDocFinal || resposta.numeroOficio || "");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const isRequerimentoExtrajudicial = assunto === "Requerimento EXTRAJUDICIAL";

    if (!numeroProcesso.trim() && !isRequerimentoExtrajudicial) {
      toast.error("Informe o número do processo.");
      return;
    }
    if (!parte.trim()) {
      toast.error("Informe a parte.");
      return;
    }
    if (!origemDU) {
      toast.error("Selecione a origem do processo DU.");
      return;
    }
    if (!assunto.trim()) {
      toast.error("Selecione o assunto principal do processo DU.");
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

      if (!ehAdminOuChefe && setorPerfilCanonico && setorPerfilCanonico !== "DU") {
        toast.error("Seu perfil no Firestore não está vinculado ao setor DU.");
        return;
      }
    }

    setLoading(true);

    try {
      // Verificação de duplicidade DU
      if (numeroProcesso.trim()) {
        const q = query(
          collection(db, "processos"),
          where("setor", "==", "DU"),
          where("numeroProcesso", "==", numeroProcesso.trim())
        );
        const querySnapshot = await getDocs(q);

        let isDuplicate = false;
        querySnapshot.forEach((docSnap) => {
          if (!processo?.id || docSnap.id !== processo.id) {
            isDuplicate = true;
          }
        });

        if (isDuplicate) {
          toast.error(`Já existe um processo cadastrado com o número ${numeroProcesso.trim()}.`);
          setLoading(false);
          return;
        }
      }
      const agora = Timestamp.now();
      const agoraISO = new Date().toISOString();
      const nomeBaseAutor = user?.nomeGuerra || user?.nome || user?.email?.split("@")[0] || "Sistema";
      const autorCadastro = user?.posto ? `${user.posto} ${nomeBaseAutor}`.trim() : nomeBaseAutor;
      const autorIdCadastro = user?.uid || "sistema";
      const autorEmailCadastro = user?.email || null;

      const dados: Record<string, unknown> = {
        numeroProcesso: numeroProcesso.trim(),
        parte: parte.trim(),
        assunto: assunto.trim(),
        dataEntrada,
        observacoes: observacoes.trim() || null,
        setor: "DU",
        status: "Aguardando Distribuição",
        finalizado: processo?.id ? (processo.status === "concluido") : false,
        criadoEm: processo?.id ? undefined : agora,
        atualizadoEm: agora,
        userId: user!.uid,
        userEmail: user!.email,
        criadoPorNome: autorCadastro,
        criadoPorUid: autorIdCadastro,
        criadoPorEmail: autorEmailCadastro,

        origemDU,
        secaoDU,
        isMS,
        prazoInternoDU: prazoInternoDU || null,
        prazoFatalDU: prazoFatalDU || null,
        notificacaoAdminPendente: true,
        notificacaoAdminEm: agoraISO,
        notificacaoAdminPorNome: autorCadastro,
        notificacaoAdminDescricao: "Novo processo DU aguardando distribuição.",
      };

      if (processo?.id) {
        const numeroSaidaNormalizado = duNumeroSaida.trim();
        const numeroRecebidoNormalizado = duNumeroRecebido.trim();
        const numeroDocFinalNormalizado = duNumeroDocFinal.trim();
        const dataPrazoNormalizada = duDataPrazoFluxo.trim();
        const pedidoAtual = processo.pedidoSubsidios || {};
        const respostaAtual = processo.respostaDU || {};

        dados.pedidoSubsidios = {
          ...pedidoAtual,
          dataPrazo: dataPrazoNormalizada || null,
          prazoResposta: dataPrazoNormalizada || null,
          numeroSaida: numeroSaidaNormalizado || null,
          numeroDiex: numeroSaidaNormalizado || pedidoAtual.numeroDiex || null,
          numeroRecebido: numeroRecebidoNormalizado || null,
          numeroDocFinal: numeroDocFinalNormalizado || null,
        };

        dados.respostaDU = {
          ...respostaAtual,
          numeroRecebido: numeroRecebidoNormalizado || null,
          numeroOficio: numeroDocFinalNormalizado || null,
        };
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
        dados.ativo = true;

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

        toast.success("Processo cadastrado com sucesso!");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{processo ? "Editar Processo DU" : "Cadastrar Processo DU"}</DialogTitle>
          <DialogDescription>
            {processo ? "Atualize as informações do processo DU." : "Preencha os dados para cadastrar um novo processo DU."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numeroProcesso" className="uppercase text-xs font-semibold">NUP / SAPIENS / Nº Documento</Label>
              <Input
                id="numeroProcesso"
                value={numeroProcesso}
                onChange={(e) => setNumeroProcesso(e.target.value)}
                placeholder="Ex: 0001234-56..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="parte" className="uppercase text-xs font-semibold">Parte / Interessado</Label>
              <Input id="parte" value={parte} onChange={(e) => setParte(e.target.value)} placeholder="Nome" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assunto">Assunto *</Label>
            <Select value={assunto} onValueChange={setAssunto}>
              <SelectTrigger id="assunto">
                <SelectValue placeholder="Selecione o assunto principal" />
              </SelectTrigger>
              <SelectContent>
                {assuntosDUPrincipais.map((ass) => (
                  <SelectItem key={ass} value={ass}>{ass}</SelectItem>
                ))}
                {!!assunto && !assuntosDUPrincipais.includes(assunto) && (
                  <SelectItem value={assunto}>{assunto}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origemDU">Origem *</Label>
              <Select value={origemDU} onValueChange={setOrigemDU}>
                <SelectTrigger id="origemDU">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {origensDUDocumentos.map((orig) => (
                    <SelectItem key={orig} value={orig}>{orig}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secaoDU">Seção</Label>
              <Select value={secaoDU} onValueChange={setSecaoDU}>
                <SelectTrigger id="secaoDU">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {secoesDU.map((sec) => (
                    <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="isMS" checked={isMS} onCheckedChange={(checked) => setIsMS(checked as boolean)} />
            <Label htmlFor="isMS" className="font-normal cursor-pointer">É Mandado de Segurança / Urgente?</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prazoInternoDU">Prazo Interno</Label>
              <Input id="prazoInternoDU" type="date" value={prazoInternoDU} onChange={(e) => setPrazoInternoDU(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazoFatalDU">Prazo Fatal</Label>
              <Input id="prazoFatalDU" type="date" value={prazoFatalDU} onChange={(e) => setPrazoFatalDU(e.target.value)} />
            </div>
          </div>

          {processo?.id && (
            <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <h4 className="text-sm font-semibold text-sky-900">Resultados DU</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duDataPrazoFluxo">Data de prazo (fluxo)</Label>
                  <Input id="duDataPrazoFluxo" type="date" value={duDataPrazoFluxo} onChange={(e) => setDuDataPrazoFluxo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duNumeroSaida">Nº envio/saída</Label>
                  <Input id="duNumeroSaida" value={duNumeroSaida} onChange={(e) => setDuNumeroSaida(e.target.value)} placeholder="Ex: DIEx 123/2026" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duNumeroRecebido">Nº documento recebido</Label>
                  <Input id="duNumeroRecebido" value={duNumeroRecebido} onChange={(e) => setDuNumeroRecebido(e.target.value)} placeholder="Ex: DIEx 456/2026" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duNumeroDocFinal">Nº documento final</Label>
                  <Input id="duNumeroDocFinal" value={duNumeroDocFinal} onChange={(e) => setDuNumeroDocFinal(e.target.value)} placeholder="Ex: Ofício 789/2026" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dataEntrada" className="uppercase text-xs font-semibold">Data de Entrada *</Label>
            <Input id="dataEntrada" type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes" className="uppercase text-xs font-semibold">Observações / Informações Iniciais</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhe aqui o caso específico do assunto DU selecionado..."
              rows={3}
            />
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
