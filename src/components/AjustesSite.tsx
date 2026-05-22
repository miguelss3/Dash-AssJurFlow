import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Elementos canônicos de controle do dnd-kit mapeados na raiz
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors, PointerSensor, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import type { SiteSettings, PAInProgressColumnId, ColumnTabId } from "@/types/siteSettings";
import { DEFAULT_SITE_SETTINGS } from "@/types/siteSettings";

// Subcomponentes modulares da pasta ajustes
import { AjustesGerais } from "./ajustes/AjustesGerais";
import AjustesDU from "./ajustes/AjustesDU";
import AjustesPA from "./ajustes/AjustesPA";
import { SortableAssuntoRow, AssuntoDragPreview, SortableFlowActionCard } from "./ajustes/SortableItem";

interface AjustesSiteProps {
  settings: SiteSettings;
  loading?: boolean;
  onSave: (settings: SiteSettings) => Promise<void>;
}

export function AjustesSite({ settings, loading = false, onSave }: AjustesSiteProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [gerandoBackup, setGerandoBackup] = useState(false);

  // Estados de controle de abertura dos Collapsibles
  const [openGeral, setOpenGeral] = useState(false);
  const [openPA, setOpenPA] = useState(false);
  const [openDU, setOpenDU] = useState(false);
  const [openPAAssuntos, setOpenPAAssuntos] = useState(false);
  const [openPAPrazos, setOpenPAPrazos] = useState(false);
  const [openPAAbas, setOpenPAAbas] = useState(false);
  const [openPAFluxo, setOpenPAFluxo] = useState(false);
  const [openDUAssuntos, setOpenDUAssuntos] = useState(false);
  const [openDUOrigens, setOpenDUOrigens] = useState(false);
  const [openDUSecoes, setOpenDUSecoes] = useState(false);

  // Estados dos inputs e manipuladores de Drag
  const [novoAssuntoPA, setNovoAssuntoPA] = useState("");
  const [novoAssuntoDU, setNovoAssuntoDU] = useState("");
  const [selectedPAPreviewColumnId, setSelectedPAPreviewColumnId] = useState<PAInProgressColumnId>("sindicancia");
  const [selectedPAPreviewTabId, setSelectedPAPreviewTabId] = useState<ColumnTabId>("andamento");
  const [modoPAAvancado, setModoPAAvancado] = useState(false);
  const [selectedFlowActionIndex, setSelectedFlowActionIndex] = useState<number | null>(null);
  const selectedFlowEditorRef = useRef<HTMLDivElement | null>(null);
  
  const [dragAssuntoPAId, setDragAssuntoPAId] = useState<string | null>(null);
  const [dragAssuntoDUId, setDragAssuntoDUId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"PA" | "DU">("PA");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Processamento e mapeamento estável de arrays e IDs do dnd-kit
  const assuntoPAIds = useMemo(() => (form.assuntosPASindicancia || []).map((_, index) => `pa-${index}`), [form.assuntosPASindicancia]);
  const assuntoDUIds = useMemo(() => (form.assuntosDUPrincipais || []).map((_, index) => `du-${index}`), [form.assuntosDUPrincipais]);

  const dragAssuntoPALabel = useMemo(() => {
    if (!dragAssuntoPAId) return "";
    const index = Number(dragAssuntoPAId.replace("pa-", ""));
    return form.assuntosPASindicancia[index] || "";
  }, [dragAssuntoPAId, form.assuntosPASindicancia]);

  const dragAssuntoDULabel = useMemo(() => {
    if (!dragAssuntoDUId) return "";
    const index = Number(dragAssuntoDUId.replace("du-", ""));
    return form.assuntosDUPrincipais[index] || "";
  }, [dragAssuntoDUId, form.assuntosDUPrincipais]);

  const selectedFlowAction = useMemo(() => {
    if (selectedFlowActionIndex === null || !form.paFlowActions) return null;
    return { acao: form.paFlowActions[selectedFlowActionIndex], index: selectedFlowActionIndex };
  }, [form.paFlowActions, selectedFlowActionIndex]);

  const updateField = (field: keyof SiteSettings, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateAssuntoPA = (index: number, value: string) => {
    setForm((prev) => {
      const lista = [...prev.assuntosPASindicancia];
      lista[index] = value;
      return { ...prev, assuntosPASindicancia: lista };
    });
  };

  const removeAssuntoPA = (index: number) => {
    setForm((prev) => ({ ...prev, assuntosPASindicancia: prev.assuntosPASindicancia.filter((_, i) => i !== index) }));
  };

  const addAssuntoPA = () => {
    const texto = novoAssuntoPA.trim();
    if (!texto) return;
    setForm((prev) => ({ ...prev, assuntosPASindicancia: [...prev.assuntosPASindicancia, texto] }));
    setNovoAssuntoPA("");
  };

  const handleDragStartPA = (event: DragStartEvent) => setDragAssuntoPAId(String(event.active.id));
  const handleDragCancelPA = () => setDragAssuntoPAId(null);
  const handleDragEndPA = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) { setDragAssuntoPAId(null); return; }
    const oldIndex = Number(String(active.id).replace("pa-", ""));
    const newIndex = Number(String(over.id).replace("pa-", ""));
    setForm((prev) => ({ ...prev, assuntosPASindicancia: arrayMove(prev.assuntosPASindicancia, oldIndex, newIndex) }));
    setDragAssuntoPAId(null);
  };

  const updateAssuntoDU = (index: number, value: string) => {
    setForm((prev) => {
      const lista = [...prev.assuntosDUPrincipais];
      lista[index] = value;
      return { ...prev, assuntosDUPrincipais: lista };
    });
  };

  const removeAssuntoDU = (index: number) => {
    setForm((prev) => ({ ...prev, assuntosDUPrincipais: prev.assuntosDUPrincipais.filter((_, i) => i !== index) }));
  };

  const addAssuntoDU = () => {
    const texto = novoAssuntoDU.trim();
    if (!texto) return;
    setForm((prev) => ({ ...prev, assuntosDUPrincipais: [...prev.assuntosDUPrincipais, texto] }));
    setNovoAssuntoDU("");
  };

  const handleDragStartDU = (event: DragStartEvent) => setDragAssuntoDUId(String(event.active.id));
  const handleDragCancelDU = () => setDragAssuntoDUId(null);
  const handleDragEndDU = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) { setDragAssuntoDUId(null); return; }
    const oldIndex = Number(String(active.id).replace("du-", ""));
    const newIndex = Number(String(over.id).replace("du-", ""));
    setForm((prev) => ({ ...prev, assuntosDUPrincipais: arrayMove(prev.assuntosDUPrincipais, oldIndex, newIndex) }));
    setDragAssuntoDUId(null);
  };

  const handleBackupLocal = async () => {
    try {
      setGerandoBackup(true);
      const snapshot = await getDocs(query(collection(db, "processos"), where("setor", "in", ["DU", "PA"])));
      const dados = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_processos_${new Date().toISOString().split("T")}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Backup local gerado com sucesso!");
    } catch {
      toast.error("Erro ao gerar backup local.");
    } finally {
      setGerandoBackup(false);
    }
  };

  const handleSave = async () => {
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
        updatedAt: new Date().toISOString()
      });
      toast.success("Ajustes publicados com sucesso!");
    } catch {
      toast.error("Erro ao salvar ajustes no servidor.");
    } finally {
      setSaving(false);
    }
  };

  const previewFooter = useMemo(() => `© ${new Date().getFullYear()} ${form.footerText}`, [form.footerText]);

  return (
    <div className="space-y-6">
      {/* BANNER DO HEAD */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Settings2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-xl font-bold text-foreground">Ajustes do Site</h3>
            <p className="mt-1 text-sm text-muted-foreground">Área do administrador para gerenciar parâmetros do ecossistema.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6 rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="rounded-2xl border border-border bg-card p-6 mb-4">
            <Button type="button" variant="outline" onClick={handleBackupLocal} disabled={gerandoBackup || saving || loading}>
              {gerandoBackup ? "Gerando arquivo..." : "💾 Baixar Backup Local (JSON)"}
            </Button>
          </div>

          <AjustesGerais form={form} openGeral={openGeral} setOpenGeral={setOpenGeral} updateField={updateField} />

          <AjustesDU
            form={form} openDU={openDU} setOpenDU={setOpenDU} openDUAssuntos={openDUAssuntos} setOpenDUAssuntos={setOpenDUAssuntos}
            assuntoDUIds={assuntoDUIds} addAssuntoDU={addAssuntoDU} updateAssuntoDU={updateAssuntoDU} removeAssuntoDU={removeAssuntoDU} 
            dragAssuntoDUId={dragAssuntoDUId} dragAssuntoDULabel={dragAssuntoDULabel}
            handleDragStartDU={handleDragStartDU} handleDragCancelDU={handleDragCancelDU} handleDragEndDU={handleDragEndDU}
            DndContext={DndContext} SortableContext={SortableContext} DragOverlay={DragOverlay} sensors={sensors} closestCenter={closestCenter}
            verticalListSortingStrategy={verticalListSortingStrategy} SortableAssuntoRow={SortableAssuntoRow} AssuntoDragPreview={AssuntoDragPreview}
            novoAssuntoDU={novoAssuntoDU} setNovoAssuntoDU={setNovoAssuntoDU}
            origemDUIds={[]} secoesDUIds={[]} openDUOrigens={false} setOpenDUOrigens={() => {}} openDUSecoes={false} setOpenDUSecoes={() => {}}
            addOrigemDUDocumento={() => {}} updateOrigemDUDocumento={() => {}} removeOrigemDUDocumento={() => {}} addSecaoDU={() => {}} updateSecaoDU={() => {}} removeSecaoDU={() => {}}
          />

          <AjustesPA
            form={form} openPA={openPA} setOpenPA={setOpenPA} openPAAssuntos={openPAAssuntos} setOpenPAAssuntos={setOpenPAAssuntos}
            openPAPrazos={openPAPrazos} setOpenPAPrazos={setOpenPAPrazos} openPAAbas={openPAAbas} setOpenPAAbas={setOpenPAAbas}
            openPAFluxo={openPAFluxo} setOpenPAFluxo={setOpenPAFluxo} modoPAAvancado={modoPAAvancado} setModoPAAvancado={setModoPAAvancado}
            selectedPAPreviewColumnId={selectedPAPreviewColumnId} setSelectedPAPreviewColumnId={setSelectedPAPreviewColumnId}
            selectedPAPreviewTabId={selectedPAPreviewTabId} setSelectedPAPreviewTabId={setSelectedPAPreviewTabId}
            assuntoPAIds={assuntoPAIds} novoAssuntoPA={novoAssuntoPA} setNovoAssuntoPA={setNovoAssuntoPA} addAssuntoPA={addAssuntoPA}
            updateAssuntoPA={updateAssuntoPA} removeAssuntoPA = {removeAssuntoPA} updateField={updateField}
            paPreviewColumns={form.paEmAndamentoColumns || []} paPreviewTabs={form.columnTabs || []}
            paFlowVisual={{ padrao: [], conselho: [] }} handlePAFlowDragEnd={() => {}} selectedFlowActionIndex={selectedFlowActionIndex}
            setSelectedFlowActionIndex={setSelectedFlowActionIndex} selectedFlowAction={selectedFlowAction} selectedFlowEditorRef={selectedFlowEditorRef}
            dragAssuntoPAId={dragAssuntoPAId} dragAssuntoPALabel={dragAssuntoPALabel} handlePAFileDragStart={handleDragStartPA}
            handleDragCancelPA={handleDragCancelPA} handleDragEndPA={handleDragEndPA}
            DndContext={DndContext} SortableContext={SortableContext} DragOverlay={DragOverlay} sensors={sensors} closestCenter={closestCenter}
            verticalListSortingStrategy={verticalListSortingStrategy} SortableAssuntoRow={SortableAssuntoRow} AssuntoDragPreview={AssuntoDragPreview}
            SortableFlowActionCard={SortableFlowActionCard} paColumnTabs={[]} paEmAndamentoColumnsOrdenadas={[]} paFlowEditGroups={{ padrao: [], conselho: [], todos: [] }}
            handleDragStartPA={handleDragStartPA}
          />

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" onClick={() => setForm(DEFAULT_SITE_SETTINGS)} disabled={saving || loading}>
              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar Padrões
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar Ajustes"}
            </Button>
          </div>
        </div>

        {/* COLUNA LATERAL - PREVIA */}
        <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm sticky top-4 self-start">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">Pré-visualização</h4>
            <p className="mt-1 text-xs text-muted-foreground">Simulação em tempo real.</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow-card">
            <p className="font-display text-base font-bold text-white">{form.sidebarTitle}</p>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-amber-400">{form.sidebarSubtitle}</p>
            <p className="mt-3 text-sm font-bold text-white/90">{form.dashboardTitle}</p>
            <p className="mt-1.5 text-xs text-white/60 line-clamp-2">{form.dashboardDescription}</p>
            <div className="mt-4 inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/90">
              + {form.newProcessLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-[10px] text-muted-foreground">
            {previewFooter}
          </div>
        </div>
      </div>
    </div>
  );
}