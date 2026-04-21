import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X } from "lucide-react";
import { collection, addDoc, query, orderBy, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { Processo } from "@/types/processo";

interface ChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
}

interface Mensagem {
  id: string;
  autor: string;
  autorId: string;
  texto: string;
  timestamp: string;
}

export function ChatModal({ open, onOpenChange, processo }: ChatModalProps) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const mensagensEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última mensagem
  useEffect(() => {
    mensagensEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Carregar mensagens quando abre o modal
  useEffect(() => {
    if (!open || !processo?.id) {
      setMensagens([]);
      return;
    }

    setLoading(true);
    
    // Listener em tempo real para o histórico (subcoleção do processo)
    const historicoRef = collection(db, `processos/${processo.id}/historico`);
    const q = query(historicoRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: Mensagem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          msgs.push({
            id: doc.id,
            autor: data.autor || "Sistema",
            autorId: data.autorId || "",
            texto: data.texto || "",
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
          });
        });
        setMensagens(msgs);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar mensagens:", error);
        toast.error("Erro ao carregar histórico");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [open, processo?.id]);

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !processo?.id || !user) return;

    try {
      const historicoRef = collection(db, `processos/${processo.id}/historico`);
      
      await addDoc(historicoRef, {
        autor: user.nome || user.email?.split("@")[0] || "Usuário",
        autorId: user.uid,
        texto: novaMensagem.trim(),
        timestamp: Timestamp.now(),
      });

      setNovaMensagem("");
      toast.success("Mensagem enviada!");
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const formatarDataHora = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const titulo = processo ? `Histórico - ${processo.numero || processo.cliente || "Processo"}` : "Histórico";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 border-b bg-slate-50 rounded-t-2xl">
          <DialogTitle className="font-extrabold text-lg text-slate-800">{titulo}</DialogTitle>
        </DialogHeader>

        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              <div className="animate-spin w-8 h-8 mb-2 border-4 border-slate-300 border-t-slate-600 rounded-full" />
              <p className="text-xs font-bold uppercase tracking-widest">Buscando Histórico...</p>
            </div>
          ) : mensagens.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">
              Nenhuma movimentação registrada.
            </p>
          ) : (
            <>
              {mensagens.map((msg) => (
                <div
                  key={msg.id}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm"
                >
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
                    {msg.autor} • {formatarDataHora(msg.timestamp)}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {msg.texto}
                  </p>
                </div>
              ))}
              <div ref={mensagensEndRef} />
            </>
          )}
        </div>

        {/* Área de envio */}
        <div className="p-6 border-t bg-white rounded-b-2xl">
          <Textarea
            value={novaMensagem}
            onChange={(e) => setNovaMensagem(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            rows={3}
            placeholder="Digite uma movimentação... (Ctrl+Enter para enviar)"
            className="resize-none"
          />
          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-slate-400">
              {novaMensagem.length}/500 caracteres
            </span>
            <Button
              onClick={enviarMensagem}
              disabled={!novaMensagem.trim()}
              className="bg-[#1a365d] hover:bg-[#1a365d]/90"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
