import { useEffect, useMemo, useState } from "react";
import { MonitorCog, RotateCcw, Save, Settings2, Type } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_SITE_SETTINGS,
  type ProcessualDeadlineSettings,
  type SiteSettings,
} from "@/types/siteSettings";

interface AjustesSiteProps {
  settings: SiteSettings;
  loading?: boolean;
  onSave: (settings: SiteSettings) => Promise<void>;
}

export function AjustesSite({ settings, loading = false, onSave }: AjustesSiteProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = <K extends keyof SiteSettings>(field: K, value: SiteSettings[K]) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const processualFields: Array<keyof ProcessualDeadlineSettings> = [
    "prazoIPMInicialDias",
    "prazoIPMProrrogacaoDias",
    "prazoSindicanciaInicialDias",
    "prazoSindicanciaProrrogacaoDias",
    "prazoConselhoInicialDias",
    "prazoConselhoProrrogacaoDias",
  ];

  const previewFooter = useMemo(
    () => `© ${new Date().getFullYear()} ${form.footerText}`,
    [form.footerText],
  );

  const lastUpdateLabel = useMemo(() => {
    if (!settings.updatedAt) return "Ainda sem publicações nesta área.";

    const updatedAt = new Date(settings.updatedAt);
    const when = Number.isNaN(updatedAt.getTime())
      ? settings.updatedAt
      : updatedAt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

    const author = settings.updatedByName || settings.updatedByEmail || "Admin";
    return `Última publicação: ${when} por ${author}.`;
  }, [settings.updatedAt, settings.updatedByEmail, settings.updatedByName]);

  const handleReset = () => {
    setForm(DEFAULT_SITE_SETTINGS);
  };

  const handleSave = async () => {
    const camposObrigatorios: Array<keyof SiteSettings> = [
      "sidebarTitle",
      "sidebarSubtitle",
      "dashboardTitle",
      "dashboardDescription",
      "newProcessLabel",
      "footerText",
    ];

    if (camposObrigatorios.some((campo) => !String(form[campo] || "").trim())) {
      toast.error("Preencha todos os campos antes de salvar.");
      return;
    }

    if (processualFields.some((campo) => !Number.isFinite(form[campo]) || Number(form[campo]) <= 0)) {
      toast.error("Os prazos processuais devem ser números maiores que zero.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        sidebarTitle: form.sidebarTitle.trim(),
        sidebarSubtitle: form.sidebarSubtitle.trim(),
        dashboardTitle: form.dashboardTitle.trim(),
        dashboardDescription: form.dashboardDescription.trim(),
        newProcessLabel: form.newProcessLabel.trim(),
        footerText: form.footerText.trim(),
        prazoIPMInicialDias: Math.trunc(Number(form.prazoIPMInicialDias)),
        prazoIPMProrrogacaoDias: Math.trunc(Number(form.prazoIPMProrrogacaoDias)),
        prazoSindicanciaInicialDias: Math.trunc(Number(form.prazoSindicanciaInicialDias)),
        prazoSindicanciaProrrogacaoDias: Math.trunc(Number(form.prazoSindicanciaProrrogacaoDias)),
        prazoConselhoInicialDias: Math.trunc(Number(form.prazoConselhoInicialDias)),
        prazoConselhoProrrogacaoDias: Math.trunc(Number(form.prazoConselhoProrrogacaoDias)),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)]">
            <Settings2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-bold text-foreground">Ajustes do Site</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Área exclusiva do administrador para editar textos estratégicos do layout principal.
            </p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground/80">{lastUpdateLabel}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <section className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <Type className="h-4 w-4 text-[var(--tipo-pa)]" />
                Branding da Sidebar
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Define o nome institucional exibido no menu lateral.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ajuste-sidebar-title">Título do Sistema</Label>
                <Input
                  id="ajuste-sidebar-title"
                  value={form.sidebarTitle}
                  onChange={(e) => updateField("sidebarTitle", e.target.value)}
                  placeholder="Ex: AssJur Flow"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ajuste-sidebar-subtitle">Subtítulo Institucional</Label>
                <Input
                  id="ajuste-sidebar-subtitle"
                  value={form.sidebarSubtitle}
                  onChange={(e) => updateField("sidebarSubtitle", e.target.value)}
                  placeholder="Ex: 12ª Região Militar"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <MonitorCog className="h-4 w-4 text-[var(--tipo-pa)]" />
                Cabeçalho Principal
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Ajusta o título e o texto-resumo exibidos na tela principal do painel.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ajuste-dashboard-title">Título do Painel</Label>
              <Input
                id="ajuste-dashboard-title"
                value={form.dashboardTitle}
                onChange={(e) => updateField("dashboardTitle", e.target.value)}
                placeholder="Ex: Painel de Controle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ajuste-dashboard-description">Descrição do Painel</Label>
              <Textarea
                id="ajuste-dashboard-description"
                rows={3}
                value={form.dashboardDescription}
                onChange={(e) => updateField("dashboardDescription", e.target.value)}
                placeholder="Resumo curto do painel principal"
              />
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                Prazos Processuais de PA
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Ajusta os prazos-base e as prorrogações legais que hoje alimentam Sindicância, IPM e Conselhos no fluxo ativo.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--tipo-pa)]">IPM</p>
                <div className="grid gap-4 md:grid-cols-2 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="prazo-ipm-inicial">Prazo Inicial (dias)</Label>
                    <Input
                      id="prazo-ipm-inicial"
                      type="number"
                      min={1}
                      value={form.prazoIPMInicialDias}
                      onChange={(e) => updateField("prazoIPMInicialDias", e.target.valueAsNumber || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prazo-ipm-prorrogacao">Prorrogação (dias)</Label>
                    <Input
                      id="prazo-ipm-prorrogacao"
                      type="number"
                      min={1}
                      value={form.prazoIPMProrrogacaoDias}
                      onChange={(e) => updateField("prazoIPMProrrogacaoDias", e.target.valueAsNumber || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--tipo-pa)]">Sindicância</p>
                <div className="grid gap-4 md:grid-cols-2 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="prazo-sindicancia-inicial">Prazo Inicial (dias)</Label>
                    <Input
                      id="prazo-sindicancia-inicial"
                      type="number"
                      min={1}
                      value={form.prazoSindicanciaInicialDias}
                      onChange={(e) => updateField("prazoSindicanciaInicialDias", e.target.valueAsNumber || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prazo-sindicancia-prorrogacao">Prorrogação (dias)</Label>
                    <Input
                      id="prazo-sindicancia-prorrogacao"
                      type="number"
                      min={1}
                      value={form.prazoSindicanciaProrrogacaoDias}
                      onChange={(e) => updateField("prazoSindicanciaProrrogacaoDias", e.target.valueAsNumber || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--tipo-pa)]">Conselhos</p>
                <div className="grid gap-4 md:grid-cols-2 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="prazo-conselho-inicial">Prazo Inicial (dias)</Label>
                    <Input
                      id="prazo-conselho-inicial"
                      type="number"
                      min={1}
                      value={form.prazoConselhoInicialDias}
                      onChange={(e) => updateField("prazoConselhoInicialDias", e.target.valueAsNumber || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prazo-conselho-prorrogacao">Prorrogação (dias)</Label>
                    <Input
                      id="prazo-conselho-prorrogacao"
                      type="number"
                      min={1}
                      value={form.prazoConselhoProrrogacaoDias}
                      onChange={(e) => updateField("prazoConselhoProrrogacaoDias", e.target.valueAsNumber || 0)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-5">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                Ação e Rodapé
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Controla o rótulo do botão principal e o texto institucional do rodapé.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ajuste-new-process">Texto do Botão Principal</Label>
              <Input
                id="ajuste-new-process"
                value={form.newProcessLabel}
                onChange={(e) => updateField("newProcessLabel", e.target.value)}
                placeholder="Ex: Novo Processo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ajuste-footer-text">Texto do Rodapé</Label>
              <Textarea
                id="ajuste-footer-text"
                rows={3}
                value={form.footerText}
                onChange={(e) => updateField("footerText", e.target.value)}
                placeholder="Texto exibido no rodapé"
              />
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={handleReset} disabled={saving || loading}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrões
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Ajustes"}
            </Button>
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">Pré-visualização</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Esta prévia mostra como os textos ficam no layout principal após a publicação.
            </p>
          </div>

          <div className="rounded-3xl bg-gradient-sidebar p-5 text-sidebar-foreground shadow-card">
            <p className="font-display text-lg font-bold leading-none text-white">{form.sidebarTitle}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[oklch(0.78_0.18_145)]">
              {form.sidebarSubtitle}
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-background p-5">
            <p className="font-display text-2xl font-bold text-foreground">{form.dashboardTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{form.dashboardDescription}</p>

            <div className="mt-5 inline-flex items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md">
              {form.newProcessLabel}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-5 space-y-3">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-700">Regras Processuais Ativas</p>
            <div className="grid gap-2 text-sm text-slate-700">
              <p>IPM: <span className="font-semibold">{form.prazoIPMInicialDias}d</span> + <span className="font-semibold">{form.prazoIPMProrrogacaoDias}d</span> por prorrogação</p>
              <p>Sindicância: <span className="font-semibold">{form.prazoSindicanciaInicialDias}d</span> + <span className="font-semibold">{form.prazoSindicanciaProrrogacaoDias}d</span> por prorrogação</p>
              <p>Conselhos: <span className="font-semibold">{form.prazoConselhoInicialDias}d</span> + <span className="font-semibold">{form.prazoConselhoProrrogacaoDias}d</span> por prorrogação</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
            {previewFooter}
          </div>
        </div>
      </div>
    </div>
  );
}