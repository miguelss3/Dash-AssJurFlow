import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { collection, getDocs, limit, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface LogErro {
  id: string;
  contexto?: string;
  mensagem?: string;
  stack?: string | null;
  extra?: Record<string, unknown> | null;
  userEmail?: string | null;
  rota?: string | null;
  criadoEm?: Timestamp | null;
}

interface AjustesLogsProps {
  openLogs: boolean;
  setOpenLogs: (open: boolean) => void;
}

// Painel de leitura dos erros capturados automaticamente (ver
// src/lib/errorLog.ts) — dá visibilidade de erros que acontecem na sessão
// de QUALQUER usuário sem precisar pedir pra alguém abrir o DevTools.
export function AjustesLogs({ openLogs, setOpenLogs }: AjustesLogsProps) {
  const [logs, setLogs] = useState<LogErro[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);

  const carregarLogs = async () => {
    setCarregando(true);
    try {
      const q = query(collection(db, "logsErro"), orderBy("criadoEm", "desc"), limit(100));
      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LogErro));
      setCarregouUmaVez(true);
    } catch (error) {
      console.error("Erro ao carregar logs de erro:", error);
    } finally {
      setCarregando(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setOpenLogs(open);
    if (open && !carregouUmaVez) void carregarLogs();
  };

  const formatarData = (valor?: Timestamp | null) => {
    if (!valor || typeof valor.toDate !== "function") return "-";
    try {
      return valor.toDate().toLocaleString("pt-BR");
    } catch {
      return "-";
    }
  };

  return (
    <Collapsible open={openLogs} onOpenChange={handleOpenChange}>
      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              <AlertTriangle className="h-4 w-4 text-slate-500" />
              Logs de Erro
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Erros do sistema capturados automaticamente, de qualquer usuário — últimos 100.
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openLogs ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">{logs.length} registro(s)</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void carregarLogs()} disabled={carregando}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${carregando ? "animate-spin" : ""}`} />
              {carregando ? "Atualizando..." : "Atualizar"}
            </Button>
          </div>

          {logs.length === 0 && !carregando && (
            <p className="text-xs text-muted-foreground italic text-center py-6">
              {carregouUmaVez ? "Nenhum erro registrado." : "Clique em Atualizar para carregar."}
            </p>
          )}

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {logs.map((log) => {
              const aberto = expandido === log.id;
              return (
                <div key={log.id} className="rounded-lg border border-border bg-card p-3 text-xs">
                  <button
                    type="button"
                    className="w-full flex items-start justify-between gap-2 text-left"
                    onClick={() => setExpandido(aberto ? null : log.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-muted-foreground">{formatarData(log.criadoEm)}</span>
                        <span className="font-semibold text-slate-700">{log.contexto || "contexto desconhecido"}</span>
                      </div>
                      <p className="mt-1 text-red-700 break-words">{log.mensagem || "Sem mensagem"}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {log.userEmail || "usuário desconhecido"}
                        {log.rota ? ` · ${log.rota}` : ""}
                      </p>
                    </div>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 mt-0.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
                  </button>

                  {aberto && (
                    <div className="mt-2 pt-2 border-t border-border space-y-2">
                      {log.stack && (
                        <pre className="whitespace-pre-wrap break-words bg-muted/50 rounded p-2 text-[10px] text-muted-foreground max-h-48 overflow-y-auto">
                          {log.stack}
                        </pre>
                      )}
                      {log.extra && (
                        <pre className="whitespace-pre-wrap break-words bg-muted/50 rounded p-2 text-[10px] text-muted-foreground">
                          {JSON.stringify(log.extra, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
