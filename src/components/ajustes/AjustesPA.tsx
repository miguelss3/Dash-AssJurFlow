import React from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, Settings2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableAssuntoRow, AssuntoDragPreview } from "./SortableItem";
import type { SiteSettings, PAInProgressColumnSetting, ColumnTabSetting } from "@/types/siteSettings";

interface AjustesPAProps {
  form: SiteSettings;
  openPA: boolean;
  setOpenPA: (open: boolean) => void;
  openPAAssuntos: boolean;
  setOpenPAAssuntos: (open: boolean) => void;
  openPAPrazos: boolean;
  setOpenPAPrazos: (open: boolean) => void;
  openPAAbas: boolean;
  setOpenPAAbas: (open: boolean) => void;
  openPAFluxo: boolean;
  setOpenPAFluxo: (open: boolean) => void;
  modoPAAvancado: boolean;
  setModoPAAvancado: React.Dispatch<React.SetStateAction<boolean>>;
  selectedPAPreviewColumnId: string;
  setSelectedPAPreviewColumnId: (id: any) => void;
  selectedPAPreviewTabId: string;
  setSelectedPAPreviewTabId: (id: any) => void;
  assuntoPAIds: string[];
  novoAssuntoPA: string;
  setNovoAssuntoPA: (val: string) => void;
  addAssuntoPA: () => void;
  updateAssuntoPA: (index: number, value: string) => void;
  removeAssuntoPA: (index: number) => void;
  updateField: (field: any, val: any) => void;
  paPreviewColumns: PAInProgressColumnSetting[];
  paPreviewTabs: ColumnTabSetting[];
  paFlowVisual: { padrao: any[]; conselho: any[] };
  handlePAFlowDragEnd: (track: any, event: any) => void;
  selectedFlowActionIndex: number | null;
  setSelectedFlowActionIndex: (index: number | null) => void;
  selectedFlowAction: any;
  selectedFlowEditorRef: React.RefObject<HTMLDivElement | null>;
  dragAssuntoPAId: string | null;
  dragAssuntoPALabel: string;
  handleDragStartPA: (event: any) => void;
  handleDragCancelPA: () => void;
  handleDragEndPA: (event: any) => void;
  DndContext: any;
  SortableContext: any;
  DragOverlay: any;
  sensors: any;
  closestCenter: any;
  verticalListSortingStrategy: any;
  SortableAssuntoRow: any;
  AssuntoDragPreview: any;
  SortableFlowActionCard: any;
}

export default function AjustesPA(props: AjustesPAProps) {
  const {
    form, openPA, setOpenPA, openPAAssuntos, setOpenPAAssuntos, openPAPrazos, setOpenPAPrazos,
    assuntoPAIds, novoAssuntoPA, setNovoAssuntoPA, addAssuntoPA, updateAssuntoPA, removeAssuntoPA,
    updateField, sensors, closestCenter, verticalListSortingStrategy, SortableAssuntoRow, AssuntoDragPreview,
    handleDragStartPA, handleDragCancelPA, handleDragEndPA, dragAssuntoPAId, dragAssuntoPALabel
  } = props;

  return (
    <Collapsible open={openPA} onOpenChange={setOpenPA}>
      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              <Settings2 className="h-4 w-4 text-purple-600" /> Setor Processos Administrativos
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">Prazos e Assuntos de PA.</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPA ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          
          {/* SEÇÃO ASSUNTOS */}
          <Collapsible open={openPAAssuntos} onOpenChange={setOpenPAAssuntos}>
            <section className="space-y-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Assuntos PA</h4>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPAAssuntos ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStartPA} onDragCancel={handleDragCancelPA} onDragEnd={handleDragEndPA}>
                  <SortableContext items={assuntoPAIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {form.assuntosPASindicancia.map((assunto, index) => (
                        <SortableAssuntoRow key={assuntoPAIds[index] || index} id={assuntoPAIds[index]} value={assunto} placeholder="Digite o assunto" onChange={(val: string) => updateAssuntoPA(index, val)} onDelete={() => removeAssuntoPA(index)} />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>{dragAssuntoPAId ? <AssuntoDragPreview label={dragAssuntoPALabel} /> : null}</DragOverlay>
                </DndContext>
                <div className="flex gap-2">
                  <Input value={novoAssuntoPA} onChange={(e) => setNovoAssuntoPA(e.target.value)} placeholder="Novo assunto PA" />
                  <Button type="button" variant="secondary" onClick={addAssuntoPA}>
                    <Plus className="mr-2 h-4 w-4" /> Adicionar
                  </Button>
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* SEÇÃO PRAZOS */}
          <Collapsible open={openPAPrazos} onOpenChange={setOpenPAPrazos}>
            <section className="space-y-4 border-t border-border pt-5">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Prazos Processuais de PA</h4>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPAPrazos ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-purple-700">IPM</p>
                    <div className="grid gap-4 md:grid-cols-2 mt-3">
                      <div>
                        <Label>Prazo Inicial (dias)</Label>
                        <Input type="number" min={1} value={form.prazoIPMInicialDias} onChange={(e) => updateField("prazoIPMInicialDias", e.target.valueAsNumber || 0)} />
                      </div>
                      <div>
                        <Label>Prorrogação (dias)</Label>
                        <Input type="number" min={1} value={form.prazoIPMProrrogacaoDias} onChange={(e) => updateField("prazoIPMProrrogacaoDias", e.target.valueAsNumber || 0)} />
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}