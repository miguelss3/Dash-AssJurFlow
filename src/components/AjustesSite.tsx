



import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Type,
  Workflow,
  ArrowRight,
  MonitorCog
} from "lucide-react";
import { toast } from "sonner";
import { collection, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_COLUMN_TABS,
  DEFAULT_DU_BOARD_COLUMNS,
  DEFAULT_ORIGENS_DU_DOCUMENTOS,
  DEFAULT_SECOES_DU,
  DEFAULT_ASSUNTOS_PA_SINDICANCIA,
  DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
  DEFAULT_PA_EM_ANDAMENTO_COLUMNS,
  DEFAULT_PA_FLOW_ACTIONS,
  DEFAULT_SITE_SETTINGS,
  normalizarColumnTabs,
  normalizarDUBoardColumns,
  normalizarPAEmAndamentoColumns,
  normalizarPAFlowActions,
  normalizarOrigensDUDocumentos,
  normalizarSecoesDU,
  normalizarAssuntosPA,
  normalizarAssuntosDU,
  type ColumnTabId,
  type ColumnTabSetting,
  type DUBoardColumnId,
  type DUBoardColumnSetting,
  type PAInProgressColumnId,
  type PAInProgressColumnSetting,
  type PAFlowActionSetting,
  type PAFlowRole,
  type PAFlowState,
  type PAFlowTrack,
  type ProcessualDeadlineSettings,
  type SiteSettings,
} from "@/types/siteSettings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// --- SUB-COMPONENTES AUXILIARES DE ARRASTAR E SOLTAR ---
interface SortableAssuntoRowProps {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onDelete: () => void;
}

function SortableAssuntoRow({ id, value, placeholder, onChange, onDelete }: SortableAssuntoRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col gap-2 sm:flex-row sm:items-center transition-[box-shadow,opacity] duration-200 ${isDragging ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-2 flex-1">
        <Button type="button" variant="outline" size="icon" className="h-10 w-10 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </Button>
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      </div>
      <Button type="button" variant="outline" onClick={onDelete} className="shrink-0">
        <Trash2 className="mr-2 h-4 w-4" /> Excluir
      </Button>
    </div>
  );
}

function AssuntoDragPreview({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-2xl">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </span>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

function SortableFlowActionCard({ id, children, onClick, selected = false }: { id: string; children: ReactNode; onClick?: () => void; selected?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={`${isDragging ? "opacity-70" : ""} ${selected ? "ring-2 ring-sky-200 rounded-lg" : ""} cursor-pointer`} onClick={onClick}>
      <div className="mb-2 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </Button>
        <span className="text-[11px] text-muted-foreground">Arraste para reordenar o fluxo</span>
      </div>
      {children}
    </div>
  );
}

interface AjustesSiteProps {
  settings: SiteSettings;
  loading?: boolean;
  onSave: (settings: SiteSettings) => Promise<void>;
}

const PA_FLOW_STATES: PAFlowState[] = ["MESA_ASSESSOR_NOVO", "AGUARDANDO_CHEFIA", "AGUARDANDO_PRAZO", "EM_CURSO", "AGUARDANDO_CHEFIA_SOLUCAO", "APTO_FINALIZAR", "C_MEMORIA", "C_PORTARIA", "C_EM_CURSO", "C_DECISAO_AUT_NOMEANTE", "C_INTIMACAO_ACUSADO", "C_ENCAMINHAMENTO_CMTEX", "C_DECISAO_CMTEX", "CONCLUIDO"];
const PA_FLOW_STATE_LABELS: Record<PAFlowState, string> = {
  MESA_ASSESSOR_NOVO: "Mesa do Assessor (Início)",
  AGUARDANDO_CHEFIA: "Aguardando Chefia",
  AGUARDANDO_PRAZO: "Aguardando Definição de Prazo",
  EM_CURSO: "Em Curso",
  AGUARDANDO_CHEFIA_SOLUCAO: "Aguardando Chefia (Solução)",
  APTO_FINALIZAR: "Apto para Finalizar",
  C_MEMORIA: "Conselho - Memória",
  C_PORTARIA: "Conselho - Portaria",
  C_EM_CURSO: "Conselho - Em Curso",
  C_DECISAO_AUT_NOMEANTE: "Conselho - Decisão Autoridade Nomeante",
  C_INTIMACAO_ACUSADO: "Conselho - Intimação do Acusado",
  C_ENCAMINHAMENTO_CMTEX: "Conselho - Encaminhamento ao Cmt Ex",
  C_DECISAO_CMTEX: "Conselho - Decisão do Cmt Ex",
  CONCLUIDO: "Concluído",
};

const PA_FLOW_ROLE_OPTIONS: Array<{ value: PAFlowRole; label: string }> = [
  { value: "assessor_pa", label: "Assessor PA" },
  { value: "chefe_assjur", label: "Chefe AssJur" },
  { value: "ambos", label: "Ambos" },
];

const PA_FLOW_TRACK_OPTIONS: Array<{ value: PAFlowTrack; label: string }> = [
  { value: "padrao", label: "Fluxo Padrão" },
  { value: "conselho", label: "Fluxo Conselho" },
  { value: "todos", label: "Todos" },
];

// --- COMPONENTE PRINCIPAL REESTRUTURADO ---
export function AjustesSite({ settings, loading = false, onSave }: AjustesSiteProps) {
  // ...existing code...
}
                            onClick={addAssuntoPA}
                            className="shrink-0"
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>

                <Collapsible open={openPAPrazos} onOpenChange={setOpenPAPrazos}>
                  <section className="space-y-4 border-t border-border pt-5">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                          Prazos Processuais de PA
                        </h4>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${openPAPrazos ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--tipo-pa)]">
                            IPM
                          </p>
                          <div className="grid gap-4 md:grid-cols-2 mt-3">
                            <div className="space-y-2">
                              <Label htmlFor="prazo-ipm-inicial">Prazo Inicial (dias)</Label>
                              <Input
                                id="prazo-ipm-inicial"
                                type="number"
                                min={1}
                                value={form.prazoIPMInicialDias}
                                onChange={(e) =>
                                  updateField("prazoIPMInicialDias", e.target.valueAsNumber || 0)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="prazo-ipm-prorrogacao">Prorrogação (dias)</Label>
                              <Input
                                id="prazo-ipm-prorrogacao"
                                type="number"
                                min={1}
                                value={form.prazoIPMProrrogacaoDias}
                                onChange={(e) =>
                                  updateField(
                                    "prazoIPMProrrogacaoDias",
                                    e.target.valueAsNumber || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--tipo-pa)]">
                            Sindicância
                          </p>
                          <div className="grid gap-4 md:grid-cols-2 mt-3">
                            <div className="space-y-2">
                              <Label htmlFor="prazo-sindicancia-inicial">
                                Prazo Inicial (dias)
                              </Label>
                              <Input
                                id="prazo-sindicancia-inicial"
                                type="number"
                                min={1}
                                value={form.prazoSindicanciaInicialDias}
                                onChange={(e) =>
                                  updateField(
                                    "prazoSindicanciaInicialDias",
                                    e.target.valueAsNumber || 0,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="prazo-sindicancia-prorrogacao">
                                Prorrogação (dias)
                              </Label>
                              <Input
                                id="prazo-sindicancia-prorrogacao"
                                type="number"
                                min={1}
                                value={form.prazoSindicanciaProrrogacaoDias}
                                onChange={(e) =>
                                  updateField(
                                    "prazoSindicanciaProrrogacaoDias",
                                    e.target.valueAsNumber || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4 md:col-span-2">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--tipo-pa)]">
                            Conselhos
                          </p>
                          <div className="grid gap-4 md:grid-cols-2 mt-3">
                            <div className="space-y-2">
                              <Label htmlFor="prazo-conselho-inicial">Prazo Inicial (dias)</Label>
                              <Input
                                id="prazo-conselho-inicial"
                                type="number"
                                min={1}
                                value={form.prazoConselhoInicialDias}
                                onChange={(e) =>
                                  updateField(
                                    "prazoConselhoInicialDias",
                                    e.target.valueAsNumber || 0,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="prazo-conselho-prorrogacao">Prorrogação (dias)</Label>
                              <Input
                                id="prazo-conselho-prorrogacao"
                                type="number"
                                min={1}
                                value={form.prazoConselhoProrrogacaoDias}
                                onChange={(e) =>
                                  updateField(
                                    "prazoConselhoProrrogacaoDias",
                                    e.target.valueAsNumber || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>

                <Collapsible open={openPAAbas} onOpenChange={setOpenPAAbas}>
                  <section className="space-y-4 border-t border-border pt-5">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                          Abas das Colunas
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Renomeie e inclua/exclua abas de cada coluna usando habilitar/desabilitar.
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${openPAAbas ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2 space-y-4">
                      <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                          Prévia visual das colunas PA
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Clique no chip da coluna ou na aba para editar diretamente nesta prévia.
                        </p>

                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {paPreviewColumns.map((coluna) => (
                            <div
                              key={`preview-pa-col-${coluna.id}`}
                              className={`min-w-[260px] rounded-2xl border p-3 space-y-3 ${selectedPAPreviewColumnId === coluna.id ? "border-[var(--tipo-pa)]/40 bg-background" : "border-border bg-card"} ${coluna.enabled !== false ? "" : "opacity-60"}`}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedPAPreviewColumnId(coluna.id)}
                                className="inline-flex items-center rounded-full border border-[var(--tipo-pa)]/30 bg-[var(--tipo-pa-bg)] px-3 py-1 text-xs font-bold text-[var(--tipo-pa)]"
                              >
                                PA · {coluna.label}
                              </button>

                              <div
                                className="rounded-xl bg-muted p-1 gap-1 grid"
                                style={{
                                  gridTemplateColumns: `repeat(${Math.max(1, paPreviewTabs.length)}, minmax(0, 1fr))`,
                                }}
                              >
                                {paPreviewTabs.map((aba) => {
                                  const count =
                                    aba.id === "andamento" ? 2 : aba.id === "atraso" ? 1 : 0;
                                  const active = selectedPAPreviewTabId === aba.id;

                                  return (
                                    <button
                                      key={`preview-pa-tab-${coluna.id}-${aba.id}`}
                                      type="button"
                                      onClick={() => {
                                        setSelectedPAPreviewColumnId(coluna.id);
                                        setSelectedPAPreviewTabId(aba.id);
                                      }}
                                      className={`min-h-[52px] px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-colors leading-tight ${
                                        active
                                          ? "bg-background text-foreground shadow-sm"
                                          : "text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      <span className="block">{aba.label}</span>
                                      <span className="block mt-1 text-[11px]">({count})</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        {(() => {
                          const abaSelecionada = paColumnTabs.find(
                            (aba) => aba.id === selectedPAPreviewTabId,
                          );
                          const colunaSelecionada = paEmAndamentoColumnsOrdenadas.find(
                            (coluna) => coluna.id === selectedPAPreviewColumnId,
                          );
                          if (!abaSelecionada) return null;
                          if (!colunaSelecionada) return null;

                          return (
                            <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3 space-y-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                                Edição direta da prévia
                              </p>

                              <div className="space-y-2">
                                <Label htmlFor="pa-preview-column-label">
                                  Nome da coluna (chip)
                                </Label>
                                <Input
                                  id="pa-preview-column-label"
                                  value={colunaSelecionada.label}
                                  onChange={(e) =>
                                    updatePAEmAndamentoColumn(colunaSelecionada.id, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="Ex: 📗 Sindicancias"
                                />
                              </div>

                              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={colunaSelecionada.enabled !== false}
                                  onChange={(e) =>
                                    updatePAEmAndamentoColumn(colunaSelecionada.id, {
                                      enabled: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-border"
                                />
                                Coluna habilitada
                              </label>

                              <div className="space-y-2">
                                <Label htmlFor="pa-preview-tab-label">Nome da aba</Label>
                                <Input
                                  id="pa-preview-tab-label"
                                  value={abaSelecionada.label}
                                  onChange={(e) =>
                                    updateColumnTab("PA", abaSelecionada.id, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="Ex: Em Andamento"
                                />
                              </div>

                              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={abaSelecionada.enabled !== false}
                                  onChange={(e) =>
                                    updateColumnTab("PA", abaSelecionada.id, {
                                      enabled: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-border"
                                />
                                Habilitada
                              </label>
                            </div>
                          );
                        })()}
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>

                <Collapsible open={openPAFluxo} onOpenChange={setOpenPAFluxo}>
                  <section className="space-y-4 border-t border-border pt-5">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                          Ações do Fluxo PA
                        </h4>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${openPAFluxo ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2 space-y-4">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {modoPAAvancado
                              ? "Modo avançado: edição completa de campos técnicos do fluxo."
                              : "Modo simples: preencha apenas o essencial. O sistema corrige os campos técnicos automaticamente ao salvar."}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setModoPAAvancado((prev) => !prev)}
                          >
                            {modoPAAvancado ? "Modo simples" : "Modo avançado"}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background p-3 space-y-3">
                        <h5 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
                          <Workflow className="h-4 w-4 text-[var(--tipo-pa)]" />
                          Fluxograma Visual das Ações
                        </h5>
                        <p className="text-[11px] text-muted-foreground">
                          Clique em uma ação para editá-la. Arraste para{" "}
                          <span className="font-semibold text-slate-600">reordenar</span> o fluxo.
                        </p>

                        <div className="grid gap-3 md:grid-cols-2">
                          {/* Trilha Sindicância / IPM */}
                          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-2 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                              Sindicância / IPM
                            </p>
                            {paFlowVisual.padrao.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">Nenhuma ação.</p>
                            ) : (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handlePAFlowDragEnd("padrao", event)}
                              >
                                <SortableContext
                                  items={paFlowVisual.padrao.map(
                                    ({ index }) => `pa-flow-visual-padrao-${index}`,
                                  )}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-1.5">
                                    {paFlowVisual.padrao.map(({ acao, index }) => (
                                      <SortableFlowActionCard
                                        key={`flow-padrao-${acao.id}`}
                                        id={`pa-flow-visual-padrao-${index}`}
                                        onClick={() => setSelectedFlowActionIndex(index)}
                                        selected={selectedFlowActionIndex === index}
                                      >
                                        <div
                                          className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                                            selectedFlowActionIndex === index
                                              ? "border-amber-400 bg-amber-100/60 ring-1 ring-amber-200"
                                              : "border-amber-100 bg-white hover:bg-amber-50"
                                          }`}
                                        >
                                          <p className="font-semibold text-slate-800">
                                            {acao.label}
                                          </p>
                                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                                            <span>{PA_FLOW_STATE_LABELS[acao.fromState]}</span>
                                            <ArrowRight className="h-2.5 w-2.5" />
                                            <span>{PA_FLOW_STATE_LABELS[acao.toState]}</span>
                                          </div>
                                        </div>
                                      </SortableFlowActionCard>
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            )}
                          </div>

                          {/* Trilha Conselhos */}
                          <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-2 space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-indigo-400" />
                              Conselhos
                            </p>
                            {paFlowVisual.conselho.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground">Nenhuma ação.</p>
                            ) : (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handlePAFlowDragEnd("conselho", event)}
                              >
                                <SortableContext
                                  items={paFlowVisual.conselho.map(
                                    ({ index }) => `pa-flow-visual-conselho-${index}`,
                                  )}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-1.5">
                                    {paFlowVisual.conselho.map(({ acao, index }) => (
                                      <SortableFlowActionCard
                                        key={`flow-conselho-${acao.id}`}
                                        id={`pa-flow-visual-conselho-${index}`}
                                        onClick={() => setSelectedFlowActionIndex(index)}
                                        selected={selectedFlowActionIndex === index}
                                      >
                                        <div
                                          className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                                            selectedFlowActionIndex === index
                                              ? "border-indigo-400 bg-indigo-100/60 ring-1 ring-indigo-200"
                                              : "border-indigo-100 bg-white hover:bg-indigo-50"
                                          }`}
                                        >
                                          <p className="font-semibold text-slate-800">
                                            {acao.label}
                                          </p>
                                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                                            <span>{PA_FLOW_STATE_LABELS[acao.fromState]}</span>
                                            <ArrowRight className="h-2.5 w-2.5" />
                                            <span>{PA_FLOW_STATE_LABELS[acao.toState]}</span>
                                          </div>
                                        </div>
                                      </SortableFlowActionCard>
                                    ))}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedFlowAction && (
                        <div
                          ref={selectedFlowEditorRef}
                          className="rounded-2xl border border-sky-200 bg-sky-50/30 p-3 space-y-2"
                        >
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                            Edição da Ação Selecionada
                          </p>
                          {renderPAFlowEditorGroup(
                            "",
                            "",
                            [selectedFlowAction],
                            "",
                            selectedFlowAction.acao.track,
                            false,
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        {renderPAFlowEditorGroup(
                          "Ações Comuns (todos)",
                          "Ações comuns podem ser usadas nas duas trilhas.",
                          paFlowEditGroups.todos,
                          "Nenhuma ação comum cadastrada.",
                          "todos",
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => addPAFlowAction("padrao")}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Nova ação de Sindicância/IPM
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => addPAFlowAction("conselho")}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Nova ação de Conselhos
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => addPAFlowAction("todos")}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Nova ação comum
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <Collapsible open={openDU} onOpenChange={setOpenDU}>
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                    Setor DU
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assuntos exibidos no dropdown de cadastro de processos de Defesa de Usuários.
                  </p>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${openDU ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-4 space-y-5">
                {/* V5.3 — Bloco "Colunas de DU" removido. As labels e a habilitação
                    das colunas DU permanecem persistidas via duBoardColumns
                    (DEFAULT_DU_BOARD_COLUMNS), porém a UI de edição foi descontinuada. */}

                {/* V2.11 — Bloco "Ações do Fluxo DU" removido. O motor V2.9 do
                    AcoesDUModalNovo é hardcoded; configurar essas ações
                    dinamicamente tornou-se obsoleto e perigoso. */}
                <Collapsible open={openDUAssuntos} onOpenChange={setOpenDUAssuntos}>
                  <section className="space-y-4 border-t border-border pt-5">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-du)]" />
                          Assuntos DU no Cadastro
                        </h4>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${openDUAssuntos ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2 space-y-3">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStartDU}
                        onDragCancel={handleDragCancelDU}
                        onDragEnd={handleDragEndDU}
                      >
                        <SortableContext
                          items={assuntoDUIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {form.assuntosDUPrincipais.map((assunto, index) => (
                              <SortableAssuntoRow
                                key={assuntoDUIds[index]}
                                id={assuntoDUIds[index]}
                                value={assunto}
                                placeholder="Digite o assunto"
                                onChange={(value) => updateAssuntoDU(index, value)}
                                onDelete={() => removeAssuntoDU(index)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {dragAssuntoDULabel ? (
                            <AssuntoDragPreview label={dragAssuntoDULabel} />
                          ) : null}
                        </DragOverlay>
                      </DndContext>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          value={novoAssuntoDU}
                          onChange={(e) => setNovoAssuntoDU(e.target.value)}
                          placeholder="Novo assunto DU"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addAssuntoDU}
                          className="shrink-0"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>

                <Collapsible open={openDUOrigens} onOpenChange={setOpenDUOrigens}>
                  <section className="space-y-4 border-t border-border pt-5">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-du)]" />
                          Origens de Documentos DU no Cadastro
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Edite as opções exibidas no dropdown de origem durante o cadastro de
                          processos DU.
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${openDUOrigens ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2 space-y-3">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStartOrigemDU}
                        onDragCancel={handleDragCancelOrigemDU}
                        onDragEnd={handleDragEndOrigemDU}
                      >
                        <SortableContext
                          items={origemDUIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {form.origensDUDocumentos.map((origem, index) => (
                              <SortableAssuntoRow
                                key={origemDUIds[index]}
                                id={origemDUIds[index]}
                                value={origem}
                                placeholder="Digite a origem do documento"
                                onChange={(value) => updateOrigemDUDocumento(index, value)}
                                onDelete={() => removeOrigemDUDocumento(index)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {dragOrigemDULabel ? (
                            <AssuntoDragPreview label={dragOrigemDULabel} />
                          ) : null}
                        </DragOverlay>
                      </DndContext>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          value={novaOrigemDUDocumento}
                          onChange={(e) => setNovaOrigemDUDocumento(e.target.value)}
                          placeholder="Nova origem de documento DU"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOrigemDUDocumento(); } }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addOrigemDUDocumento}
                          className="shrink-0"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>

                <Collapsible open={openDUSecoes} onOpenChange={setOpenDUSecoes}>
                  <section className="space-y-4 border-t border-border pt-5">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-du)]" />
                          Seções (Origem/Destino)
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Edite as seções exibidas no dropdown de origem/destino durante o cadastro
                          de processos DU.
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${openDUSecoes ? "rotate-180" : ""}`}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2 space-y-3">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStartSecaoDU}
                        onDragCancel={handleDragCancelSecaoDU}
                        onDragEnd={handleDragEndSecaoDU}
                      >
                        <SortableContext
                          items={secoesDUIds}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-2">
                            {(form.secoesDU ?? []).map((secao, index) => (
                              <SortableAssuntoRow
                                key={secoesDUIds[index]}
                                id={secoesDUIds[index]}
                                value={secao}
                                placeholder="Digite a seção"
                                onChange={(value) => updateSecaoDU(index, value)}
                                onDelete={() => removeSecaoDU(index)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                        <DragOverlay>
                          {dragSecaoDULabel ? (
                            <AssuntoDragPreview label={dragSecaoDULabel} />
                          ) : null}
                        </DragOverlay>
                      </DndContext>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          value={novaSecaoDU}
                          onChange={(e) => setNovaSecaoDU(e.target.value)}
                          placeholder="Nova seção (origem/destino)"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSecaoDU(); } }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={addSecaoDU}
                          className="shrink-0"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Adicionar
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </section>
                </Collapsible>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={saving || loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar Padrões
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Ajustes"}
            </Button>
          </div>

        </div>

        <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm sticky top-4 self-start">
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Pré-visualização
            </h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Atualiza em tempo real conforme você edita as configurações.
            </p>
          </div>

          {/* Header / Sidebar preview */}
          <div className="rounded-2xl bg-gradient-sidebar p-4 text-sidebar-foreground shadow-card">
            <p className="font-display text-base font-bold leading-none text-white">
              {form.sidebarTitle}
            </p>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[oklch(0.78_0.18_145)]">
              {form.sidebarSubtitle}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[9px] text-white/40 uppercase tracking-wider">
                {form.dashboardTitle}
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="mt-1.5 text-[10px] text-white/50 line-clamp-1">
              {form.dashboardDescription}
            </p>
            <div className="mt-3 inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/90">
              + {form.newProcessLabel}
            </div>
          </div>

          {/* Abas PA / DU */}
          <div>
            <div className="flex rounded-xl border border-border bg-muted/30 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreviewTab("PA")}
                className={`flex-1 rounded-lg py-1.5 transition-all ${previewTab === "PA" ? "bg-[var(--tipo-pa-bg)] text-[var(--tipo-pa)] shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                📋 Processo Administrativo
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("DU")}
                className={`flex-1 rounded-lg py-1.5 transition-all ${previewTab === "DU" ? "bg-sky-100 text-sky-700 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                📩 Defesa da União
              </button>
            </div>

            {previewTab === "PA" && (
              <div className="mt-3 space-y-3">
                {/* Abas do PA */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Abas de navegação
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {paColumnTabs.filter((a) => a.enabled).length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        Nenhuma aba ativa
                      </span>
                    ) : (
                      paColumnTabs
                        .filter((a) => a.enabled)
                        .map((aba) => (
                          <span
                            key={aba.id}
                            className="inline-flex items-center rounded-md bg-[var(--tipo-pa-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--tipo-pa)]"
                          >
                            {aba.label}
                          </span>
                        ))
                    )}
                    {paColumnTabs
                      .filter((a) => !a.enabled)
                      .map((aba) => (
                        <span
                          key={aba.id}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground line-through opacity-50"
                        >
                          {aba.label}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Colunas "Em Andamento" PA */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Colunas em andamento
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {paEmAndamentoColumnsOrdenadas.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        Nenhuma coluna configurada
                      </span>
                    ) : (
                      paEmAndamentoColumnsOrdenadas.map((coluna) => (
                        <div
                          key={coluna.id}
                          className={`flex-shrink-0 w-28 rounded-xl border p-2 space-y-1.5 ${coluna.enabled ? "border-[var(--tipo-pa)]/30 bg-[var(--tipo-pa-bg)]" : "border-border bg-muted/30 opacity-40"}`}
                        >
                          <p className="text-[10px] font-bold text-[var(--tipo-pa)] leading-tight line-clamp-2">
                            {coluna.label}
                          </p>
                          <div className="space-y-1">
                            {[1, 2].map((i) => (
                              <div
                                key={i}
                                className="h-5 rounded-md bg-white/70 border border-[var(--tipo-pa)]/10 flex items-center px-1.5 gap-1"
                              >
                                <div className="h-1.5 w-1.5 rounded-full bg-[var(--tipo-pa)]/40 flex-shrink-0" />
                                <div className="h-1 flex-1 rounded bg-[var(--tipo-pa)]/20" />
                              </div>
                            ))}
                          </div>
                          {!coluna.enabled && (
                            <p className="text-[8px] text-center text-muted-foreground font-semibold uppercase">
                              oculta
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Prazos PA */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Prazos processuais
                  </p>
                  <div className="space-y-1">
                    {[
                      {
                        label: "IPM",
                        inicial: form.prazoIPMInicialDias,
                        prorrog: form.prazoIPMProrrogacaoDias,
                      },
                      {
                        label: "Sindicância",
                        inicial: form.prazoSindicanciaInicialDias,
                        prorrog: form.prazoSindicanciaProrrogacaoDias,
                      },
                      {
                        label: "Conselho",
                        inicial: form.prazoConselhoInicialDias,
                        prorrog: form.prazoConselhoProrrogacaoDias,
                      },
                    ].map(({ label, inicial, prorrog }) => {
                      const total = inicial + prorrog;
                      const pct = Math.round((inicial / total) * 100);
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span className="w-18 text-[10px] font-semibold text-slate-600 shrink-0">
                            {label}
                          </span>
                          <div className="flex flex-1 h-3 rounded-full overflow-hidden bg-muted">
                            <div
                              className="h-full bg-[var(--tipo-pa)] transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="h-full flex-1 bg-[var(--tipo-pa)]/25" />
                          </div>
                          <span className="text-[9px] text-muted-foreground shrink-0">
                            {inicial}+{prorrog}d
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Assuntos PA */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Assuntos (sindicância)
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {form.assuntosPASindicancia.slice(0, 6).map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-slate-600"
                      >
                        {a}
                      </span>
                    ))}
                    {form.assuntosPASindicancia.length > 6 && (
                      <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        +{form.assuntosPASindicancia.length - 6}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {previewTab === "DU" && (
              <div className="mt-3 space-y-3">
                {/* Abas do DU */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Abas de navegação
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {duColumnTabs.filter((a) => a.enabled).length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        Nenhuma aba ativa
                      </span>
                    ) : (
                      duColumnTabs
                        .filter((a) => a.enabled)
                        .map((aba) => (
                          <span
                            key={aba.id}
                            className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700"
                          >
                            {aba.label}
                          </span>
                        ))
                    )}
                    {duColumnTabs
                      .filter((a) => !a.enabled)
                      .map((aba) => (
                        <span
                          key={aba.id}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground line-through opacity-50"
                        >
                          {aba.label}
                        </span>
                      ))}
                  </div>
                </div>

                {/* Colunas DU */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Colunas do quadro
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {duBoardColumnsOrdenadas.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">
                        Nenhuma coluna configurada
                      </span>
                    ) : (
                      duBoardColumnsOrdenadas.map((coluna) => (
                        <div
                          key={coluna.id}
                          className={`flex-shrink-0 w-28 rounded-xl border p-2 space-y-1.5 ${coluna.enabled ? "border-sky-200 bg-sky-50" : "border-border bg-muted/30 opacity-40"}`}
                        >
                          <p className="text-[10px] font-bold text-sky-700 leading-tight line-clamp-2">
                            {coluna.label}
                          </p>
                          <div className="space-y-1">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="h-5 rounded-md bg-white/80 border border-sky-100 flex items-center px-1.5 gap-1"
                              >
                                <div className="h-1.5 w-1.5 rounded-full bg-sky-400/50 flex-shrink-0" />
                                <div className="h-1 flex-1 rounded bg-sky-200/50" />
                              </div>
                            ))}
                          </div>
                          {!coluna.enabled && (
                            <p className="text-[8px] text-center text-muted-foreground font-semibold uppercase">
                              oculta
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Assuntos DU */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Assuntos principais
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {form.assuntosDUPrincipais.slice(0, 6).map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex rounded-md bg-sky-50 border border-sky-100 px-1.5 py-0.5 text-[9px] text-sky-700"
                      >
                        {a}
                      </span>
                    ))}
                    {form.assuntosDUPrincipais.length > 6 && (
                      <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        +{form.assuntosDUPrincipais.length - 6}
                      </span>
                    )}
                  </div>
                </div>

                {/* Origens DU */}
                <div>
                  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Origens de documentos
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {form.origensDUDocumentos.slice(0, 5).map((o, i) => (
                      <span
                        key={i}
                        className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-slate-600"
                      >
                        {o}
                      </span>
                    ))}
                    {form.origensDUDocumentos.length > 5 && (
                      <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                        +{form.origensDUDocumentos.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-[10px] text-muted-foreground">
            {previewFooter}
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableFlowActionCard({
  id,
  children,
  onClick,
  selected = false,
}: {
  id: string;
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: {
      duration: 220,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? "opacity-70" : ""} ${selected ? "ring-2 ring-sky-200 rounded-lg" : ""} cursor-pointer`}
      onClick={onClick}
    >
      <div className="mb-2 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 cursor-grab active:cursor-grabbing"
          aria-label="Reordenar ação"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <span className="text-[11px] text-muted-foreground">Arraste para reordenar o fluxo</span>
      </div>
      {children}
    </div>
  );
}
