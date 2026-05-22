import React from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Type, MonitorCog, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { SiteSettings } from "@/types/siteSettings";

interface AjustesGeraisProps {
  form: SiteSettings;
  openGeral: boolean;
  setOpenGeral: (open: boolean) => void;
  updateField: (field: keyof SiteSettings, value: any) => void;
}

export function AjustesGerais({ form, openGeral, setOpenGeral, updateField }: AjustesGeraisProps) {
  return (
    <Collapsible open={openGeral} onOpenChange={setOpenGeral}>
      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              <Type className="h-4 w-4 text-slate-500" />
              Setor Geral
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Branding, cabeçalho e textos institucionais do sistema.
            </p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openGeral ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          <section className="space-y-4">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <Type className="h-4 w-4 text-slate-500" />
                Branding da Sidebar
              </h4>
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

          <section className="space-y-4 border-t border-border pt-5 mt-5">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <MonitorCog className="h-4 w-4 text-slate-500" />
                Cabeçalho Principal
              </h4>
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

          <section className="space-y-4 border-t border-border pt-5 mt-5">
            <div>
              <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                <Settings2 className="h-4 w-4 text-slate-500" />
                Ação e Rodapé
              </h4>
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
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
