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

interface AcoesPAModalNovoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoId: string;
  numeroProcesso: string;
  onSuccess?: () => void;
}

export function AcoesPAModalNovo({ open, onOpenChange, processoId, numeroProcesso, onSuccess }: AcoesPAModalNovoProps) {
  const { user } = useAuth();
  const [acaoSelecionada, setAcaoSelecionada] = useState<string | null>(null);

  // Estados para Iniciar Prazo
  const [dataInicioPrazo, setDataInicioPrazo] = useState(new Date().toISOString().split("T")[0]);

  // Estados para Substituir Encarregado
  const [novoEncarregado, setNovoEncarregado] = useState("");
  const [novaPortaria, setNovaPortaria] = useState("");
  const [motivoSubstituicao, setMotivoSubstituicao] = useState("");

  const resetFormularios = () => {
    setAcaoSelecionada(null);
    setDataInicioPrazo(new Date().toISOString().split("T")[0]);
    setNovoEncarregado("");
    setNovaPortaria("");
    setMotivoSubstituicao("");
  };

  const handleEnviarAssinatura = async () => {
    if (!processoId || !user) return;

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const msgHistorico = `📋 ${user.email?.split("@")[0]} encaminhou para assinatura do Cmt.`;

      await updateDoc(processoRef, {
        aguardandoAssinaturaCmt: true,
        notificadoAssinaturaCmtEm: agoraISO,
        notificadoAssinaturaCmtPorNome: user.email || "Assessor",
        status: "Aguardando Assinatura",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
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

      toast.success("Processo enviado para assinatura do Cmt!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao enviar para assinatura:", error);
      toast.error("Erro ao enviar para assinatura");
    }
  };

  const handleIniciarPrazo = async () => {
    if (!processoId || !user) return;

    if (!dataInicioPrazo) {
      toast.error("Selecione a data de início do prazo.");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const msgHistorico = `⏱️ Prazo iniciado em ${new Date(dataInicioPrazo).toLocaleDateString("pt-BR")} por ${user.email?.split("@")[0]}.`;

      await updateDoc(processoRef, {
        dataInicialPrazo: dataInicioPrazo,
        dataInicialPrazoPorNome: user.email || "Assessor",
        status: "Em Instrução",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
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

      toast.success("Prazo iniciado com sucesso!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao iniciar prazo:", error);
      toast.error("Erro ao iniciar prazo");
    }
  };

  const handleSubstituirEncarregado = async () => {
    if (!processoId || !user) return;

    if (!novoEncarregado.trim()) {
      toast.error("Informe o novo encarregado.");
      return;
    }
    if (!novaPortaria.trim()) {
      toast.error("Informe a nova portaria.");
      return;
    }

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const msgHistorico = `🔄 Encarregado substituído para ${novoEncarregado} pela portaria ${novaPortaria}. Registrado por ${user.email?.split("@")[0]}.`;

      await updateDoc(processoRef, {
        encarregado: novoEncarregado,
        substituicaoEncarregado: {
          novoEncarregado,
          novaPortaria,
          motivo: motivoSubstituicao.trim() || "",
          registradoEm: agoraISO,
          registradoPorNome: user.email || "Sistema",
        },
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
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

      toast.success("Encarregado substituído com sucesso!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao substituir encarregado:", error);
      toast.error("Erro ao substituir encarregado");
    }
  };

  const handleConfirmarAssinatura = async () => {
    if (!processoId || !user || !isAdmin(user)) return;

    try {
      const agoraISO = new Date().toISOString();
      const processoRef = doc(db, "processos", processoId);

      const msgHistorico = `✅ Portaria assinada pelo Cmt. Registrado por ${user.email?.split("@")[0]}. Prazo liberado para início.`;

      await updateDoc(processoRef, {
        aguardandoAssinaturaCmt: false,
        portariaAssinadaEm: agoraISO,
        portariaAssinadaPorNome: user.email || "Admin",
        notificacaoAdminPendente: false,
        status: "Aguardando Início de Prazo",
        descricao: msgHistorico,
        atualizadoEm: Timestamp.now(),
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

      toast.success("Assinatura confirmada!");
      resetFormularios();
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Erro ao confirmar assinatura:", error);
      toast.error("Erro ao confirmar assinatura");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(opening) => {
      if (!opening) resetFormularios();
      onOpenChange(opening);
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações PA - {numeroProcesso}</DialogTitle>
          <DialogDescription className="sr-only">
            Gerenciar ações de Processos Administrativos
          </DialogDescription>
        </DialogHeader>

        {!acaoSelecionada && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700">Selecione uma ação:</h3>
            
            {!isAdmin(user) && (
              <>
                <Button
                  onClick={() => setAcaoSelecionada("enviar_assinatura")}
                  className="w-full justify-start border-purple-300 text-purple-700 hover:bg-purple-50"
                  variant="outline"
                >
                  📋 Enviar p/ Assinatura Cmt
                </Button>

                <Button
                  onClick={() => setAcaoSelecionada("iniciar_prazo")}
                  className="w-full justify-start border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  variant="outline"
                >
                  ▶ Iniciar Prazo
                </Button>

                <Button
                  onClick={() => setAcaoSelecionada("substituir_encarregado")}
                  className="w-full justify-start border-orange-300 text-orange-700 hover:bg-orange-50"
                  variant="outline"
                >
                  🔄 Substituir Encarregado
                </Button>
              </>
            )}

            {isAdmin(user) && (
              <Button
                onClick={() => setAcaoSelecionada("confirmar_assinatura")}
                className="w-full justify-start border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                variant="outline"
              >
                ✅ Confirmar Assinatura
              </Button>
            )}
          </div>
        )}

        {acaoSelecionada === "enviar_assinatura" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-purple-700">📋 Enviar p/ Assinatura Cmt</h3>
            <p className="text-sm text-slate-600">
              O processo será encaminhado para a mesa do administrador aguardando assinatura do Comandante.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Cancelar
              </Button>
              <Button onClick={handleEnviarAssinatura} className="bg-purple-600">
                Enviar para Assinatura
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "iniciar_prazo" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-emerald-700">▶ Iniciar Prazo</h3>
            
            <div className="space-y-2">
              <Label>Data de Início do Prazo</Label>
              <Input 
                type="date"
                value={dataInicioPrazo} 
                onChange={(e) => setDataInicioPrazo(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Normalmente é a data de hoje, mas pode ser ajustada se necessário.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Cancelar
              </Button>
              <Button onClick={handleIniciarPrazo} className="bg-emerald-600">
                Iniciar Prazo
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "substituir_encarregado" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-orange-700">🔄 Substituir Encarregado</h3>
            
            <div className="space-y-2">
              <Label>Novo Encarregado *</Label>
              <Input 
                value={novoEncarregado} 
                onChange={(e) => setNovoEncarregado(e.target.value)}
                placeholder="Ex: Maj Silva" 
              />
            </div>

            <div className="space-y-2">
              <Label>Nova Portaria *</Label>
              <Input 
                value={novaPortaria} 
                onChange={(e) => setNovaPortaria(e.target.value)}
                placeholder="Ex: Portaria Nr 15/2026" 
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo da Substituição (opcional)</Label>
              <Textarea 
                value={motivoSubstituicao} 
                onChange={(e) => setMotivoSubstituicao(e.target.value)}
                placeholder="Ex: Substituição por diligência, férias, etc..." 
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSubstituirEncarregado} className="bg-orange-600">
                Registrar Substituição
              </Button>
            </div>
          </div>
        )}

        {acaoSelecionada === "confirmar_assinatura" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-emerald-700">✅ Confirmar Assinatura</h3>
            <p className="text-sm text-slate-600">
              Confirme que a Portaria foi assinada pelo Comandante. O processo será devolvido ao assessor para início do prazo.
            </p>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAcaoSelecionada(null)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarAssinatura} className="bg-emerald-600">
                Confirmar Assinatura
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
