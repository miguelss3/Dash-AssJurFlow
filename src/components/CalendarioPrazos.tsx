import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  AlertTriangle,
  Gavel,
  Coffee,
  Users,
  FileClock,
  Trash2,
  X,
} from "lucide-react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Processo } from "@/types/processo";
import {
  useEventosCalendario,
  type EventoCalendario,
  type TipoEvento,
} from "@/hooks/useEventosCalendario";
import { statusPrazo } from "@/lib/prazo";

interface Props {
  processos: Processo[];
  usuario: { posto: string; nome: string; role?: string };
}

interface DiaItem {
  tipo: "prazo-interno" | "prazo-fatal" | TipoEvento;
  titulo: string;
  ref?: string; // numero processo
  responsavel?: string;
  evento?: EventoCalendario;
  processo?: Processo;
}

const TIPOS_EVENTO: { id: TipoEvento; label: string; icon: typeof CalendarIcon; cor: string }[] = [
  { id: "prazo", label: "Prazo / Tarefa", icon: FileClock, cor: "oklch(0.6 0.16 230)" },
  { id: "audiencia", label: "Audiência", icon: Gavel, cor: "oklch(0.55 0.2 290)" },
  { id: "reuniao", label: "Reunião", icon: Users, cor: "oklch(0.65 0.18 200)" },
  { id: "feriado", label: "Feriado", icon: CalendarIcon, cor: "oklch(0.6 0.2 25)" },
  { id: "sem_expediente", label: "Sem Expediente", icon: Coffee, cor: "oklch(0.55 0.05 50)" },
];

function corDoTipo(t: TipoEvento | "prazo-interno" | "prazo-fatal"): string {
  if (t === "prazo-interno") return "oklch(0.7 0.18 60)";
  if (t === "prazo-fatal") return "oklch(0.55 0.22 25)";
  const m = TIPOS_EVENTO.find((x) => x.id === t);
  return m?.cor ?? "oklch(0.6 0.05 240)";
}

function iconeDoTipo(t: TipoEvento | "prazo-interno" | "prazo-fatal") {
  if (t === "prazo-interno") return AlertTriangle;
  if (t === "prazo-fatal") return AlertTriangle;
  const m = TIPOS_EVENTO.find((x) => x.id === t);
  return m?.icon ?? CalendarIcon;
}

function labelTipo(t: TipoEvento | "prazo-interno" | "prazo-fatal"): string {
  if (t === "prazo-interno") return "Prazo Interno";
  if (t === "prazo-fatal") return "Prazo Fatal";
  return TIPOS_EVENTO.find((x) => x.id === t)?.label ?? t;
}

export function CalendarioPrazos({ processos, usuario }: Props) {
  const { eventos, criar, remover } = useEventosCalendario();
  const [mesRef, setMesRef] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [novoTipo, setNovoTipo] = useState<TipoEvento>("prazo");
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [novaData, setNovaData] = useState(format(new Date(), "yyyy-MM-dd"));

  const inicio = startOfWeek(startOfMonth(mesRef), { weekStartsOn: 0 });
  const fim = endOfWeek(endOfMonth(mesRef), { weekStartsOn: 0 });

  const dias: Date[] = useMemo(() => {
    const out: Date[] = [];
    const cur = new Date(inicio);
    while (cur <= fim) {
      out.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [inicio, fim]);

  // Mapa data -> itens
  const itensPorDia = useMemo(() => {
    const map = new Map<string, DiaItem[]>();
    const push = (key: string, item: DiaItem) => {
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    };

    // Prazos automáticos vindos dos processos (ativos)
    processos
      .filter((p) => p.status !== "concluido")
      .forEach((p) => {
        const k1 = p.prazo.slice(0, 10);
        push(k1, {
          tipo: "prazo-interno",
          titulo: `${p.numero} • ${p.tipoAcao}`,
          ref: p.numero,
          responsavel: p.responsavel,
          processo: p,
        });
        if (p.prazoFatal) {
          const k2 = p.prazoFatal.slice(0, 10);
          push(k2, {
            tipo: "prazo-fatal",
            titulo: `FATAL • ${p.numero}`,
            ref: p.numero,
            responsavel: p.responsavel,
            processo: p,
          });
        }
      });

    // Eventos manuais
    eventos.forEach((e) => {
      push(e.data, {
        tipo: e.tipo,
        titulo: e.titulo,
        evento: e,
      });
    });

    return map;
  }, [processos, eventos]);

  const handleAdd = (data?: Date) => {
    const d = data ?? new Date();
    setNovaData(format(d, "yyyy-MM-dd"));
    setNovoTitulo("");
    setNovaDescricao("");
    setNovoTipo("prazo");
    setDialogOpen(true);
  };

  const handleSalvar = () => {
    if (!novoTitulo.trim()) return;
    criar({
      data: novaData,
      titulo: novoTitulo.trim(),
      descricao: novaDescricao.trim() || undefined,
      tipo: novoTipo,
      criadoPor: `${usuario.posto} ${usuario.nome}`,
    });
    setDialogOpen(false);
  };

  const itensDoDiaSelecionado: DiaItem[] = diaSelecionado
    ? itensPorDia.get(format(diaSelecionado, "yyyy-MM-dd")) ?? []
    : [];

  const diasSemana = ["Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"];

  // Resumo do mês
  const totalPrazosMes = dias
    .filter((d) => isSameMonth(d, mesRef))
    .reduce((acc, d) => {
      const items = itensPorDia.get(format(d, "yyyy-MM-dd")) ?? [];
      return acc + items.filter((i) => i.tipo === "prazo-interno" || i.tipo === "prazo-fatal").length;
    }, 0);

  const totalEventosMes = eventos.filter((e) => {
    const d = parseISO(e.data);
    return isSameMonth(d, mesRef);
  }).length;

  return (
    <div className="space-y-4">
      {/* Header com navegação e ações */}
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 rounded-xl bg-accent/40 items-center justify-center">
            <CalendarIcon className="h-5 w-5 text-accent-foreground" />
          </span>
          <div>
            <h3 className="font-bold text-lg text-foreground font-display capitalize">
              {format(mesRef, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {totalPrazosMes} prazo(s) • {totalEventosMes} evento(s) registrado(s) este mês
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setMesRef(addMonths(mesRef, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-lg text-xs font-bold"
            onClick={() => setMesRef(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-lg"
            onClick={() => setMesRef(addMonths(mesRef, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleAdd()}
            className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow font-semibold"
          >
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Lançar evento</span>
          </Button>
        </div>
      </div>

      {/* Calendário mensal */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
        {/* Header dias da semana */}
        <div className="grid grid-cols-7 bg-muted/60 border-b border-border">
          {diasSemana.map((d) => (
            <div
              key={d}
              className="px-2 py-2.5 text-[11px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider text-left"
            >
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d.slice(0, 3)}</span>
            </div>
          ))}
        </div>

        {/* Grade de dias */}
        <div className="grid grid-cols-7">
          {dias.map((d, idx) => {
            const key = format(d, "yyyy-MM-dd");
            const items = itensPorDia.get(key) ?? [];
            const fora = !isSameMonth(d, mesRef);
            const hoje = isSameDay(d, new Date());
            const selecionado = diaSelecionado && isSameDay(d, diaSelecionado);
            const semExp = items.some((i) => i.tipo === "sem_expediente" || i.tipo === "feriado");

            return (
              <button
                type="button"
                key={idx}
                onClick={() => setDiaSelecionado(d)}
                className={`relative text-left min-h-[90px] sm:min-h-[110px] border-r border-b border-border p-1.5 sm:p-2 transition-colors ${
                  fora ? "bg-muted/30" : "bg-card hover:bg-muted/40"
                } ${selecionado ? "ring-2 ring-inset ring-primary z-10" : ""} ${
                  semExp && !fora ? "bg-[oklch(0.97_0.02_25)]" : ""
                } ${(idx + 1) % 7 === 0 ? "border-r-0" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs sm:text-sm font-semibold tabular-nums inline-flex items-center justify-center ${
                      hoje
                        ? "h-6 w-6 rounded-full bg-primary text-primary-foreground"
                        : fora
                          ? "text-muted-foreground/50"
                          : "text-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  {items.length > 3 && (
                    <span className="text-[9px] font-bold text-muted-foreground">
                      +{items.length - 3}
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {items.slice(0, 3).map((item, i) => {
                    const cor = corDoTipo(item.tipo);
                    const ehPrazo = item.tipo === "prazo-interno" || item.tipo === "prazo-fatal";
                    return (
                      <div
                        key={i}
                        className="text-[10px] leading-tight px-1.5 py-0.5 rounded truncate font-medium"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`,
                          color: cor,
                          borderLeft: `2px solid ${cor}`,
                        }}
                        title={item.titulo}
                      >
                        {ehPrazo && "⚖ "}
                        {item.titulo}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legenda + ação rápida abaixo (estilo solicitado) */}
      <div className="rounded-2xl bg-card border border-border p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h4 className="font-bold text-sm text-foreground font-display flex items-center gap-2">
              <Plus className="h-4 w-4 text-accent-foreground" />
              Lançar prazo, feriado ou dia sem expediente
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Os prazos dos processos ativos aparecem automaticamente. Use o botão abaixo
              para registrar eventos manuais.
            </p>
          </div>
          <Button
            onClick={() => handleAdd(diaSelecionado ?? undefined)}
            className="h-10 rounded-xl bg-accent text-accent-foreground hover:bg-accent-glow font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Novo lançamento
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIPOS_EVENTO.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setNovoTipo(t.id);
                  handleAdd(diaSelecionado ?? undefined);
                  setNovoTipo(t.id);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all hover:scale-105"
                style={{
                  color: t.cor,
                  borderColor: `color-mix(in oklab, ${t.cor} 35%, transparent)`,
                  backgroundColor: `color-mix(in oklab, ${t.cor} 10%, transparent)`,
                }}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border"
            style={{
              color: "oklch(0.7 0.18 60)",
              borderColor: "oklch(0.7 0.18 60 / 0.35)",
              backgroundColor: "oklch(0.7 0.18 60 / 0.1)",
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            Prazo Interno (auto)
          </span>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border"
            style={{
              color: "oklch(0.55 0.22 25)",
              borderColor: "oklch(0.55 0.22 25 / 0.35)",
              backgroundColor: "oklch(0.55 0.22 25 / 0.1)",
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            Prazo Fatal (auto)
          </span>
        </div>
      </div>

      {/* Painel lateral / inferior do dia selecionado */}
      {diaSelecionado && (
        <div className="rounded-2xl bg-card border border-border p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                Dia selecionado
              </p>
              <h4 className="font-bold text-lg text-foreground font-display capitalize">
                {format(diaSelecionado, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => handleAdd(diaSelecionado)}
                className="h-9 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Adicionar neste dia
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setDiaSelecionado(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {itensDoDiaSelecionado.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">
              Nenhum prazo ou evento registrado para este dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {itensDoDiaSelecionado.map((item, i) => {
                const Icon = iconeDoTipo(item.tipo);
                const cor = corDoTipo(item.tipo);
                const ehAuto = item.tipo === "prazo-interno" || item.tipo === "prazo-fatal";
                const status = item.processo ? statusPrazo(item.processo.prazo) : null;
                return (
                  <li
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                  >
                    <span
                      className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`,
                        color: cor,
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)`,
                            color: cor,
                          }}
                        >
                          {labelTipo(item.tipo)}
                        </span>
                        {ehAuto && (
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Automático
                          </span>
                        )}
                        {status === "overdue" && (
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                            Vencido
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground leading-tight">
                        {item.titulo}
                      </p>
                      {item.responsavel && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Responsável: <span className="font-semibold">{item.responsavel}</span>
                        </p>
                      )}
                      {item.evento?.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.evento.descricao}
                        </p>
                      )}
                      {item.evento && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          Lançado por {item.evento.criadoPor}
                        </p>
                      )}
                    </div>
                    {item.evento && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remover(item.evento!.id)}
                        title="Remover evento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Dialog de novo lançamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-display">Novo lançamento no calendário</DialogTitle>
            <DialogDescription>
              Registre um prazo extra, feriado, dia sem expediente, audiência ou reunião.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tipo-evento">Tipo</Label>
              <Select value={novoTipo} onValueChange={(v) => setNovoTipo(v as TipoEvento)}>
                <SelectTrigger id="tipo-evento">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EVENTO.map((t) => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" style={{ color: t.cor }} />
                          {t.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-evento">Data</Label>
              <Input
                id="data-evento"
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="titulo-evento">Título *</Label>
              <Input
                id="titulo-evento"
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Ex: Feriado municipal, Audiência 1ª Vara..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc-evento">Descrição (opcional)</Label>
              <Textarea
                id="desc-evento"
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Detalhes adicionais..."
                rows={3}
              />
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5 border border-border">
              Lançamento será registrado em nome de{" "}
              <span className="font-bold text-foreground">
                {usuario.posto} {usuario.nome}
              </span>
              .
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={!novoTitulo.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary-glow font-semibold"
            >
              Salvar lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
