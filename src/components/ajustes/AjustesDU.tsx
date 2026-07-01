import React from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, Settings2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/types/siteSettings";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import { SortableAssuntoRow, AssuntoDragPreview } from "./SortableItem";

interface AjustesDUProps {
  form: SiteSettings;
  openDU: boolean;
  setOpenDU: (open: boolean) => void;
  openDUAssuntos: boolean;
  setOpenDUAssuntos: (open: boolean) => void;
  assuntoDUIds: string[];
  novoAssuntoDU: string;
  setNovoAssuntoDU: (val: string) => void;
  addAssuntoDU: () => void;
  updateAssuntoDU: (index: number, value: string) => void;
  removeAssuntoDU: (index: number) => void;
  dragAssuntoDUId: string | null;
  dragAssuntoDULabel: string;
  handleDragStartDU: (event: any) => void;
  handleDragCancelDU: () => void;
  handleDragEndDU: (event: any) => void;
  sensors: any;
  // Origens de Documentos DU
  openDUOrigens: boolean;
  setOpenDUOrigens: (open: boolean) => void;
  origemDUIds: string[];
  novoOrigemDU: string;
  setNovoOrigemDU: (val: string) => void;
  addOrigemDU: () => void;
  updateOrigemDU: (index: number, value: string) => void;
  removeOrigemDU: (index: number) => void;
  dragOrigemDUId: string | null;
  dragOrigemDULabel: string;
  handleDragStartOrigemDU: (event: any) => void;
  handleDragCancelOrigemDU: () => void;
  handleDragEndOrigemDU: (event: any) => void;
  // Seções DU
  openDUSecoes: boolean;
  setOpenDUSecoes: (open: boolean) => void;
  secaoDUIds: string[];
  novoSecaoDU: string;
  setNovoSecaoDU: (val: string) => void;
  addSecaoDU: () => void;
  updateSecaoDU: (index: number, value: string) => void;
  removeSecaoDU: (index: number) => void;
  dragSecaoDUId: string | null;
  dragSecaoDULabel: string;
  handleDragStartSecaoDU: (event: any) => void;
  handleDragCancelSecaoDU: () => void;
  handleDragEndSecaoDU: (event: any) => void;
}

export default function AjustesDU({
  form, openDU, setOpenDU, openDUAssuntos, setOpenDUAssuntos, assuntoDUIds,
  novoAssuntoDU, setNovoAssuntoDU, addAssuntoDU, updateAssuntoDU, removeAssuntoDU,
  dragAssuntoDUId, dragAssuntoDULabel, handleDragStartDU, handleDragCancelDU, handleDragEndDU, sensors,
  openDUOrigens, setOpenDUOrigens, origemDUIds, novoOrigemDU, setNovoOrigemDU,
  addOrigemDU, updateOrigemDU, removeOrigemDU, dragOrigemDUId, dragOrigemDULabel,
  handleDragStartOrigemDU, handleDragCancelOrigemDU, handleDragEndOrigemDU,
  openDUSecoes, setOpenDUSecoes, secaoDUIds, novoSecaoDU, setNovoSecaoDU,
  addSecaoDU, updateSecaoDU, removeSecaoDU, dragSecaoDUId, dragSecaoDULabel,
  handleDragStartSecaoDU, handleDragCancelSecaoDU, handleDragEndSecaoDU,
}: AjustesDUProps) {
  return (
    <Collapsible open={openDU} onOpenChange={setOpenDU}>
      <div className="rounded-2xl border border-border bg-background/40 p-4">
        <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
              <Settings2 className="h-4 w-4 text-sky-600" /> Setor Defesa da União
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">Gerenciamento de Assuntos de DU.</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDU ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          {/* Assuntos DU */}
          <Collapsible open={openDUAssuntos} onOpenChange={setOpenDUAssuntos}>
            <section className="space-y-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Assuntos DU</h4>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDUAssuntos ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStartDU} onDragCancel={handleDragCancelDU} onDragEnd={handleDragEndDU}>
                  <SortableContext items={assuntoDUIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {form.assuntosDUPrincipais.map((assunto, index) => (
                        <SortableAssuntoRow key={assuntoDUIds[index] || index} id={assuntoDUIds[index]} value={assunto} placeholder="Digite o assunto" onChange={(val) => updateAssuntoDU(index, val)} onDelete={() => removeAssuntoDU(index)} />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {dragAssuntoDUId ? <AssuntoDragPreview label={dragAssuntoDULabel} /> : null}
                  </DragOverlay>
                </DndContext>
                <div className="flex gap-2">
                  <Input value={novoAssuntoDU} onChange={(e) => setNovoAssuntoDU(e.target.value)} placeholder="Novo assunto DU" />
                  <Button type="button" variant="secondary" onClick={addAssuntoDU}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* Origens de Documentos DU */}
          <Collapsible open={openDUOrigens} onOpenChange={setOpenDUOrigens}>
            <section className="space-y-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Origens dos Processos</h4>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDUOrigens ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <p className="text-xs text-muted-foreground">Lista de origens disponíveis ao cadastrar um processo DU.</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStartOrigemDU} onDragCancel={handleDragCancelOrigemDU} onDragEnd={handleDragEndOrigemDU}>
                  <SortableContext items={origemDUIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {(form.origensDUDocumentos || []).map((origem, index) => (
                        <SortableAssuntoRow key={origemDUIds[index] || index} id={origemDUIds[index]} value={origem} placeholder="Ex: SAPIENS, Email, MPF..." onChange={(val) => updateOrigemDU(index, val)} onDelete={() => removeOrigemDU(index)} />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {dragOrigemDUId ? <AssuntoDragPreview label={dragOrigemDULabel} /> : null}
                  </DragOverlay>
                </DndContext>
                <div className="flex gap-2">
                  <Input value={novoOrigemDU} onChange={(e) => setNovoOrigemDU(e.target.value)} placeholder="Nova origem" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOrigemDU())} />
                  <Button type="button" variant="secondary" onClick={addOrigemDU}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>

          {/* Seções DU */}
          <Collapsible open={openDUSecoes} onOpenChange={setOpenDUSecoes}>
            <section className="space-y-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700">Seções</h4>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDUSecoes ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 space-y-3">
                <p className="text-xs text-muted-foreground">Seções disponíveis ao cadastrar ou filtrar processos DU.</p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStartSecaoDU} onDragCancel={handleDragCancelSecaoDU} onDragEnd={handleDragEndSecaoDU}>
                  <SortableContext items={secaoDUIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {(form.secoesDU || []).map((secao, index) => (
                        <SortableAssuntoRow key={secaoDUIds[index] || index} id={secaoDUIds[index]} value={secao} placeholder="Ex: SVP, SSIP, SALC..." onChange={(val) => updateSecaoDU(index, val)} onDelete={() => removeSecaoDU(index)} />
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {dragSecaoDUId ? <AssuntoDragPreview label={dragSecaoDULabel} /> : null}
                  </DragOverlay>
                </DndContext>
                <div className="flex gap-2">
                  <Input value={novoSecaoDU} onChange={(e) => setNovoSecaoDU(e.target.value)} placeholder="Nova seção" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSecaoDU())} />
                  <Button type="button" variant="secondary" onClick={addSecaoDU}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
