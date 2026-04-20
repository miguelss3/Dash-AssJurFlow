import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Processo, StatusProcesso, TipoProcesso, Prioridade } from "@/types/processo";
import { COLUNAS, TIPOS, PRIORIDADES } from "@/types/processo";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: Processo | null;
  defaultStatus?: StatusProcesso;
  onSave: (dados: Omit<Processo, "id" | "criadoEm">) => void;
}

const VAZIO = {
  numero: "",
  cliente: "",
  vara: "",
  parteContraria: "",
  tipoAcao: "",
  responsavel: "",
  prazo: "",
  prazoFatal: "",
  descricao: "",
  status: "novo" as StatusProcesso,
  tipo: "DU" as TipoProcesso,
  prioridade: "normal" as Prioridade,
  secao: "",
  origem: "",
};

function toDateInput(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ProcessoDialog({ open, onOpenChange, processo, defaultStatus, onSave }: Props) {
  const [form, setForm] = useState(VAZIO);

  useEffect(() => {
    if (open) {
      if (processo) {
        setForm({
          numero: processo.numero,
          cliente: processo.cliente,
          vara: processo.vara,
          parteContraria: processo.parteContraria,
          tipoAcao: processo.tipoAcao,
          responsavel: processo.responsavel,
          prazo: toDateInput(processo.prazo),
          prazoFatal: toDateInput(processo.prazoFatal),
          descricao: processo.descricao,
          status: processo.status,
          tipo: processo.tipo,
          prioridade: processo.prioridade,
          secao: processo.secao,
          origem: processo.origem,
        });
      } else {
        setForm({ ...VAZIO, status: defaultStatus ?? "novo" });
      }
    }
  }, [open, processo, defaultStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero || !form.cliente || !form.prazo) return;
    onSave({
      ...form,
      prazo: new Date(form.prazo + "T12:00:00").toISOString(),
      prazoFatal: form.prazoFatal
        ? new Date(form.prazoFatal + "T12:00:00").toISOString()
        : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-accent shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </span>
            {processo ? "Editar processo" : "Novo processo"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Preencha os dados do processo. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Linha 1: tipo + prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm({ ...form, tipo: v as TipoProcesso })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={form.prioridade}
                onValueChange={(v) => setForm({ ...form, prioridade: v as Prioridade })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="numero">Número do processo *</Label>
              <Input
                id="numero"
                className="font-mono-tech"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="0000000-00.0000.0.00.0000"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cliente">Parte / Cliente *</Label>
              <Input
                id="cliente"
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parteContraria">Parte contrária</Label>
              <Input
                id="parteContraria"
                value={form.parteContraria}
                onChange={(e) => setForm({ ...form, parteContraria: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vara">Vara / Comarca</Label>
              <Input
                id="vara"
                value={form.vara}
                onChange={(e) => setForm({ ...form, vara: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipoAcao">Assunto / Tipo de ação</Label>
              <Input
                id="tipoAcao"
                value={form.tipoAcao}
                onChange={(e) => setForm({ ...form, tipoAcao: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secao">Seção</Label>
              <Input
                id="secao"
                value={form.secao}
                onChange={(e) => setForm({ ...form, secao: e.target.value })}
                placeholder="SFPC, SVP..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="origem">Origem</Label>
              <Input
                id="origem"
                value={form.origem}
                onChange={(e) => setForm({ ...form, origem: e.target.value })}
                placeholder="E-mail, Ofício, DiEx..."
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={form.responsavel}
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazo">Prazo interno *</Label>
              <Input
                id="prazo"
                type="date"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prazoFatal">Prazo fatal</Label>
              <Input
                id="prazoFatal"
                type="date"
                value={form.prazoFatal}
                onChange={(e) => setForm({ ...form, prazoFatal: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as StatusProcesso })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUNAS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="descricao">Último movimento / Observações</Label>
              <Textarea
                id="descricao"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={4}
                placeholder="Andamento, próximos passos, observações relevantes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-gradient-accent text-primary-foreground hover:shadow-glow font-semibold"
            >
              {processo ? "Salvar alterações" : "Criar processo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
