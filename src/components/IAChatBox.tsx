import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, ChevronDown } from "lucide-react";
import { getAuth } from "firebase/auth";
import type { Processo } from "@/types/processo";
import { statusPrazo } from "@/lib/prazo";

interface Props {
  processos: Processo[];
}

function buildContext(processos: Processo[]): string {
  const ativos = processos.filter((p) => p.status !== "concluido");
  const du = ativos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "DU",
  );
  const pa = ativos.filter(
    (p) => (p.setor || p.tipo || "").toString().toUpperCase() === "PA",
  );
  const vencidos = du.filter(
    (p) =>
      statusPrazo(p.prazoFatal) === "overdue" ||
      statusPrazo(p.pedidoSubsidios?.prazoResposta) === "overdue",
  ).length;
  const hoje = du.filter((p) => {
    const sf = statusPrazo(p.prazoFatal);
    const sr = statusPrazo(p.pedidoSubsidios?.prazoResposta);
    if (sf === "overdue" || sr === "overdue") return false;
    return sf === "today" || sr === "today";
  }).length;
  const semana = du.filter((p) => {
    const sf = statusPrazo(p.prazoFatal);
    const sr = statusPrazo(p.pedidoSubsidios?.prazoResposta);
    if (sf === "overdue" || sr === "overdue") return false;
    return sf === "today" || sf === "soon" || sr === "today" || sr === "soon";
  }).length;

  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return [
    `Sistema: AssJur Flow — Assessoria Jurídica da 12ª Região Militar`,
    `Data: ${dataHoje}`,
    ``,
    `=== Situação Atual dos Processos ===`,
    `Processos DU ativos: ${du.length}`,
    `Processos PA ativos: ${pa.length}`,
    `Total de processos ativos: ${ativos.length}`,
    `Total geral (incluindo finalizados): ${processos.length}`,
    ``,
    `=== Controle de Prazos (DU) ===`,
    `Com prazo vencido: ${vencidos}`,
    `Vencendo hoje: ${hoje}`,
    `Vencendo nos próximos 7 dias: ${semana}`,
  ].join("\n");
}

export function IAChatBox({ processos }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [perguntaFeita, setPerguntaFeita] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [expanded]);

  async function handleSubmit() {
    const pergunta = input.trim();
    if (!pergunta || loading) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setPerguntaFeita(pergunta);
    setInput("");

    try {
      const user = getAuth().currentUser;
      if (!user) throw new Error("Usuário não autenticado.");

      const token = await user.getIdToken();
      const res = await fetch("/api/geminiChat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: pergunta,
          context: buildContext(processos),
        }),
      });

      const text = await res.text();
      if (!text) throw new Error(`Servidor não respondeu (HTTP ${res.status}). Tente novamente.`);

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Resposta inválida do servidor (HTTP ${res.status}).`);
      }

      if (!res.ok) throw new Error((data.message as string) || "Erro ao consultar IA.");
      setResponse(data.reply as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden transition-all">
      {/* Cabeçalho / Trigger */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        aria-expanded={expanded}
      >
        <span className="inline-flex h-7 w-7 rounded-lg items-center justify-center bg-[oklch(0.6_0.18_280_/_0.15)] shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-[oklch(0.55_0.22_280)]" />
        </span>
        <span className="flex-1 text-sm font-medium text-muted-foreground">
          {expanded
            ? "Assistente IA AssJur"
            : "Pergunte ao Assistente IA sobre os processos…"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Conteúdo expandido */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-3">
          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[oklch(0.55_0.22_280)]/40 focus:border-[oklch(0.55_0.22_280)]/50 transition-all"
              placeholder="Ex: Quantos DU estão com prazo vencido? Quais processos são urgentes?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
              maxLength={500}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || loading}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[oklch(0.55_0.22_280)] text-white disabled:opacity-40 hover:bg-[oklch(0.48_0.22_280)] transition-colors shrink-0"
              aria-label="Enviar pergunta"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-1">
              <div className="flex gap-1 items-center">
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.22_280)] animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.22_280)] animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.22_280)] animate-bounce [animation-delay:300ms]" />
              </div>
              <span>Consultando IA…</span>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-start gap-2">
              <span className="shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Resposta */}
          {response && !loading && (
            <div className="rounded-xl bg-[oklch(0.6_0.18_280_/_0.07)] border border-[oklch(0.55_0.22_280)]/20 p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-[oklch(0.55_0.22_280)]" />
                <span className="text-[10px] font-bold text-[oklch(0.5_0.22_280)] uppercase tracking-wider">
                  Resposta IA
                </span>
              </div>
              {perguntaFeita && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-[oklch(0.55_0.22_280)]/30 pl-2">
                  {perguntaFeita}
                </p>
              )}
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {response}
              </p>
            </div>
          )}

          {/* Aviso */}
          <p className="text-[10px] text-muted-foreground/50 leading-tight">
            ✦ Assistente com IA generativa — respostas podem conter imprecisões.
            Verifique informações críticas diretamente no sistema. Limite: 20
            perguntas por dia.
          </p>
        </div>
      )}
    </div>
  );
}
