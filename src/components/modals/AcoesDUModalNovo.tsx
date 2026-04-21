import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { doc, updateDoc, Timestamp, collection, addDoc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AcoesDUModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onSuccess?: () => void;
}

export function AcoesDUModalNovo({ open, onOpenChange, processoId, numeroProcesso, onSuccess }: AcoesDUModalNovoProps) {
  const { user } = useAuth();
  const [acaoSelecionada, setAcaoSelecionada] = useState<string | null>(null);
  
  // Estados para Solicitar Subsídios
  const [tipoPedidoSubsidio, setTipoPedidoSubsidio] = useState<"interno" | "externo">("interno");
  const [secaoInterna, setSecaoInterna] = useState("");
  const [omExterna, setOMExterna] = useState("");
  const [numeroDiex, setNumeroDiex] = useState("");
  const [prazoResposta, setPrazoResposta] = useState("");
  const [observacoesSubsidio, setObservacoesSubsidio] = useState("");
  
  // Estados para Registrar Resposta
  const [numeroOficio, setNumeroOficio] = useState("");
  const [numeroDiexResposta, setNumeroDiexResposta] = useState("");
  const [dataEnvio, setDataEnvio] = useState(new Date().toISOString().split("T")[0]);
  const [observacoesResposta, setObservacoesResposta] = useState("");

  const resetFormularios = () => {
    setAcaoSelecionada(null);
    setTipoPedidoSubsidio("interno");
    setSecaoInterna("");
    setOMExterna("");
    setNumeroDiex("");
    setPrazoResposta("");
    setObservacoesSubsidio("");
    setNumeroOficio("");
    setNumeroDiexResposta("");
    setDataEnvio(new Date().toISOString().split("T")[0]);
    setObservacoesResposta("");
  };

  const handleSolicitarSubsidios = async () => {
    if (!processoId || !user) return;

    if (tipoPedidoSubsidio === "interno" && !secaoInterna.trim()) {
      toast.error("Informe a seção interna.");
      return;
    }
    if (tipoPedidoSubsidio === "externo" && !omExterna.trim()) {
      toast.error("Informe a OM externa.");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const pedidoSubsidios = {
        tipoDestino: tipoPedidoSubsidio,
        secaoInterna: tipoPedidoSubsidio === "interno" ? secaoInterna : "",
        omExterna: tipoPedidoSubsidio === "externo" ? omExterna : "",
        numeroDiex: numeroDiex.trim() || "",
        prazoResposta: prazoResposta || "",
        observacoes: observacoesSubsidio.trim() || "",
        situacaoFluxo: "enviado_admin",
        solicitadoEm: agoraISO,
        solicitadoPorNome: user.email || "Assessor",
      };

      const msgHistorico = `📨 Subsídios solicitados para ${tipoPedidoSubsidio === "interno" ? secaoInterna : omExterna} por ${user.email?.split("@")[0]}.`;

      await updateDoc(processoRef, {
        pedidoSubsidios,
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: user.email || "Sistema",
      });

      // Adicionar ao histórico (subcoleção)
      const historicoRef = collection(db, `processos/${processoId}/historico`);
      await addDoc(historicoRef, {
        autor: user.email?.split("@")[0] || "Sistema",
        autorId: user.uid,
        texto: msgHistorico,
        timestamp: agoraISO,
      });

      // Também salvar na coleção mensagens (compatibilidade)
      const mensagensRef = doc(db, "mensagens", processoId);
      const mensagensSnap = await getDoc(mensagensRef);
      const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
      await setDoc(mensagensRef, {
        historico: [...historicoExistente, {
          id: crypto.randomUUID(),
          autor: user.email?.split("@")[0] || "Sistema",
          autorId: user.uid,
          texto: msgHistorico,
          timestamp: agoraISO,
        }]
      });

      toast.success("Pedido de subsídios enviado!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao solicitar subsídios:", error);
      toast.error("Erro ao enviar pedido de subsídios");
    }
  };

  const handleRegistrarResposta = async () => {
    if (!processoId || !user) return;

    if (!numeroOficio.trim() && !numeroDiexResposta.trim()) {
      toast.error("Informe ao menos um número (Ofício ou DIEx).");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const respostaDU = {
        numeroOficio: numeroOficio.trim() || "",
        numeroDiex: numeroDiexResposta.trim() || "",
        dataEnvio,
        observacoes: observacoesResposta.trim() || "",
        situacao: isAdmin(user) ? "em_aprovacao_chem" : "enviada_chefia",
        registradoEm: agoraISO,
        registradoPorNome: user.email || "Assessor",
      };

      const msgHistorico = isAdmin(user)
        ? `⏳ Resposta aguardando aprovação do CHEM. Registrada por ${user.email?.split("@")[0]}.`
        : `📤 Resposta enviada à chefia (Ofício: ${numeroOficio || "—"}, DIEx: ${numeroDiexResposta || "—"}) por ${user.email?.split("@")[0]}.`;

      await updateDoc(processoRef, {
        respostaDU,
        status: isAdmin(user) ? "Aguardando CHEM" : "Aguardando Conferência",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: user.email || "Sistema",
      });

      // Adicionar ao histórico (subcoleção)
      const historicoRef = collection(db, `processos/${processoId}/historico`);
      await addDoc(historicoRef, {
        autor: user.email?.split("@")[0] || "Sistema",
        autorId: user.uid,
        texto: msgHistorico,
        timestamp: agoraISO,
      });

      // Também salvar na coleção mensagens (compatibilidade)
      const mensagensRef = doc(db, "mensagens", processoId);
      const mensagensSnap = await getDoc(mensagensRef);
      const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
      await setDoc(mensagensRef, {
        historico: [...historicoExistente, {
          id: crypto.randomUUID(),
          autor: user.email?.split("@")[0] || "Sistema",
          autorId: user.uid,
          texto: msgHistorico,
          timestamp: agoraISO,
        }]
      });

      toast.success("Resposta registrada com sucesso!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao registrar resposta:", error);
      toast.error("Erro ao registrar resposta");
    }
  };

  const handleDespacharCHEM = async () => {
    if (!processoId || !user || !isAdmin(user)) return;

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const msgHistorico = `✅ Resposta assinada pelo CHEM. Registrado por ${user.email?.split("@")[0]}.`;

      await updateDoc(processoRef, {
        "respostaDU.situacao": "assinada_chem",
        status: "Concluído",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
        atualizadoPorNome: user.email || "Sistema",
      });

      // Adicionar ao histórico
      const historicoRef = collection(db, `processos/${processoId}/historico`);
      await addDoc(historicoRef, {
        autor: user.email?.split("@")[0] || "Sistema",
        autorId: user.uid,
        texto: msgHistorico,
        timestamp: agoraISO,
      });

      // Também salvar na coleção mensagens
      const mensagensRef = doc(db, "mensagens", processoId);
      const mensagensSnap = await getDoc(mensagensRef);
      const historicoExistente = mensagensSnap.exists() ? (mensagensSnap.data()?.historico || []) : [];
      await setDoc(mensagensRef, {
        historico: [...historicoExistente, {
          id: crypto.randomUUID(),
          autor: user.email?.split("@")[0] || "Sistema",
          autorId: user.uid,
          texto: msgHistorico,
          timestamp: agoraISO,
        }]
      });

      toast.success("Despacho CHEM registrado!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao despachar CHEM:", error);
      toast.error("Erro ao registrar despacho");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(opening) => {
      if (!opening) resetFormularios();
      onOpenChange(opening);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações DU - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Gerenciar ações de processos da Defesa de Usuários
          </DialogDescription>
        </DialogHeader>

        {!acaoSelecionada && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">Selecione uma ação:</h3>
            
            <Button
              onClick={() => setAcaoSelecionada("solicitar_subsidios")}
              className="w-full justify-start border-sky-300 text-sky-700 hover:bg-sky-50"
              variant="outline"
            >
              📨 Solicitar Subsídios
            </Button>

            <Button
              onClick={() => setAcaoSelecionada("registrar_resposta")}
              className="w-full justify-start border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              variant="outline"
            >
              📤 Registrar Resposta
            </Button>

            {isAdmin(user) && (
              <Button
                onClick={() => setAcaoSelecionada("despachar_chem")}
                className="w-full justify-start border-amber-300 text-amber-700 hover:bg-amber-50"
                variant="outline"
              >
                ✅ Registrar Assinatura CHEM
              </Button>
            )}
          </div>
        )}

        {acaoSelecionada === "solicitar_subsidios" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sky-700">📨 Solicitar Subsídios</h3>
            
            <div className="space-y-2">
              <Label>Tipo de Destino</Label>
              <Select value={tipoPedidoSubsidio} onValueChange={(v) => setTipoPedidoSubsidio(v as "interno" | "externo")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interno">Interno (Seção)</SelectItem>
                  <SelectItem value="externo">Externo (OM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tipoPedidoSubsidio === "interno" && (
              <div className="space-y-2">
                <Label>Seção Interna *</Label>
                <Input 
                  value={secaoInterna} 
                  onChange={(e) => setSecaoInterna(e.target.value)}
                  placeholder="Ex: SVP, SFPC, PMM..." 
                />
              </div>
            )}

            {tipoPedidoSubsidio === "externo" && (
              <div className="space-y-2">
                <Label>OM Externa *</Label>
                <Input 
                  value={omExterna} 
                  onChange={(e) => setOMExterna(e.target.value)}
                  placeholder="Ex: 1º BIS, 2ª Cia..." 
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Número do DIEx (opcional)</Label>
              <Input 
                value={numeroDiex} 
                onChange={(e) => setNumeroDiex(e.target.value)}
                placeholder="Ex: DIEx Nr 123-AsseApAssJur" 
              />
            </div>

            <div className="space-y-2">
              <Label>Prazo para Resposta</Label>
              <Input 
                type="date"
                value={prazoResposta} 
                onChange={(e) => setPrazoResposta(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={observacoesSubsidio} 
                onChange={(e) => setObservacoesSubsidio(e.target.value)}
                placeholder="Informações adicionais sobre a solicitação..." 
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Voltar
              </Button>
              <Button onClick={handleSolicitarSubsidios} className="bg-sky-600">
                Enviar Solicitação
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "registrar_resposta" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-emerald-700">📤 Registrar Resposta</h3>
            
            <div className="space-y-2">
              <Label>Número do Ofício</Label>
              <Input 
                value={numeroOficio} 
                onChange={(e) => setNumeroOficio(e.target.value)}
                placeholder="Ex: Ofício Nr 45/2026" 
              />
            </div>

            <div className="space-y-2">
              <Label>Número do DIEx</Label>
              <Input 
                value={numeroDiexResposta} 
                onChange={(e) => setNumeroDiexResposta(e.target.value)}
                placeholder="Ex: DIEx Nr 123-AsseApAssJur" 
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Envio</Label>
              <Input 
                type="date"
                value={dataEnvio} 
                onChange={(e) => setDataEnvio(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea 
                value={observacoesResposta} 
                onChange={(e) => setObservacoesResposta(e.target.value)}
                placeholder="Informações complementares sobre a resposta..." 
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Voltar
              </Button>
              <Button onClick={handleRegistrarResposta} className="bg-emerald-600">
                Registrar Resposta
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "despachar_chem" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-amber-700">✅ Registrar Assinatura CHEM</h3>
            <p className="text-sm text-slate-600">
              Confirme que o CHEM assinou a resposta. Este processo será marcado como concluído.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Cancelar
              </Button>
              <Button onClick={handleDespacharCHEM} className="bg-amber-600">
                Confirmar Assinatura
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
