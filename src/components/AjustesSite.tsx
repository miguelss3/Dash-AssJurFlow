import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  GripVertical,
  MonitorCog,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Type,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
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
  DEFAULT_ASSUNTOS_PA_SINDICANCIA,
  DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
  DEFAULT_PA_FLOW_ACTIONS,
  DEFAULT_SITE_SETTINGS,
  normalizarPAFlowActions,
  normalizarAssuntosPA,
  normalizarAssuntosDU,
  type PAFlowActionSetting,
  type PAFlowRole,
  type PAFlowState,
  type PAFlowTrack,
  type ProcessualDeadlineSettings,
  type SiteSettings,
} from "@/types/siteSettings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SortableAssuntoRowProps {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onDelete: () => void;
}

function SortableAssuntoRow({ id, value, placeholder, onChange, onDelete }: SortableAssuntoRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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
      className={`flex flex-col gap-2 sm:flex-row sm:items-center transition-[box-shadow,opacity] duration-200 ${isDragging ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-2 flex-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 cursor-grab active:cursor-grabbing"
          aria-label="Reordenar assunto"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onDelete}
        className="shrink-0"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Excluir
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

interface AjustesSiteProps {
  settings: SiteSettings;
  loading?: boolean;
  onSave: (settings: SiteSettings) => Promise<void>;
}

const PA_FLOW_STATES: PAFlowState[] = [
  "MESA_ASSESSOR_NOVO",
  "AGUARDANDO_CHEFIA",
  "AGUARDANDO_PRAZO",
  "EM_CURSO",
  "AGUARDANDO_CHEFIA_SOLUCAO",
  "APTO_FINALIZAR",
  "C_MEMORIA",
  "C_PORTARIA",
  "C_EM_CURSO",
  "C_DECISAO_AUT_NOMEANTE",
  "C_INTIMACAO_ACUSADO",
  "C_ENCAMINHAMENTO_CMTEX",
  "C_DECISAO_CMTEX",
  "CONCLUIDO",
];

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

const PA_FLOW_SEQUENCE_BY_TRACK: Record<"padrao" | "conselho", PAFlowState[]> = {
  padrao: [
    "MESA_ASSESSOR_NOVO",
    "AGUARDANDO_CHEFIA",
    "AGUARDANDO_PRAZO",
    "EM_CURSO",
    "AGUARDANDO_CHEFIA_SOLUCAO",
    "APTO_FINALIZAR",
    "CONCLUIDO",
  ],
  conselho: [
    "C_MEMORIA",
    "C_PORTARIA",
    "C_EM_CURSO",
    "C_DECISAO_AUT_NOMEANTE",
    "C_INTIMACAO_ACUSADO",
    "C_ENCAMINHAMENTO_CMTEX",
    "C_DECISAO_CMTEX",
    "CONCLUIDO",
  ],
};

export function AjustesSite({ settings, loading = false, onSave }: AjustesSiteProps) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [novoAssuntoPA, setNovoAssuntoPA] = useState("");
  const [novoAssuntoDU, setNovoAssuntoDU] = useState("");
  const [openGeral, setOpenGeral] = useState(false);
  const [openPA, setOpenPA] = useState(false);
  const [openDU, setOpenDU] = useState(false);
  const [openPAAssuntos, setOpenPAAssuntos] = useState(false);
  const [openPAPrazos, setOpenPAPrazos] = useState(false);
  const [openPAFluxo, setOpenPAFluxo] = useState(false);
  const [modoPAAvancado, setModoPAAvancado] = useState(false);
  const [selectedFlowActionIndex, setSelectedFlowActionIndex] = useState<number | null>(null);
  const selectedFlowEditorRef = useRef<HTMLDivElement | null>(null);
  const [dragAssuntoPAId, setDragAssuntoPAId] = useState<string | null>(null);
  const [dragAssuntoDUId, setDragAssuntoDUId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const assuntoPAIds = useMemo(
    () => form.assuntosPASindicancia.map((_, index) => `pa-${index}`),
    [form.assuntosPASindicancia],
  );
  const assuntoDUIds = useMemo(
    () => form.assuntosDUPrincipais.map((_, index) => `du-${index}`),
    [form.assuntosDUPrincipais],
  );
  const dragAssuntoPALabel = useMemo(() => {
    if (!dragAssuntoPAId) return "";
    const index = Number(dragAssuntoPAId.replace("pa-", ""));
    return Number.isNaN(index) ? "" : form.assuntosPASindicancia[index] || "";
  }, [dragAssuntoPAId, form.assuntosPASindicancia]);
  const dragAssuntoDULabel = useMemo(() => {
    if (!dragAssuntoDUId) return "";
    const index = Number(dragAssuntoDUId.replace("du-", ""));
    return Number.isNaN(index) ? "" : form.assuntosDUPrincipais[index] || "";
  }, [dragAssuntoDUId, form.assuntosDUPrincipais]);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const updateField = <K extends keyof SiteSettings>(field: K, value: SiteSettings[K]) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateAssuntoPA = (index: number, value: string) => {
    setForm((prev) => {
      const lista = [...prev.assuntosPASindicancia];
      lista[index] = value;
      return {
        ...prev,
        assuntosPASindicancia: lista,
      };
    });
  };

  const removeAssuntoPA = (index: number) => {
    setForm((prev) => ({
      ...prev,
      assuntosPASindicancia: prev.assuntosPASindicancia.filter((_, i) => i !== index),
    }));
  };

  const addAssuntoPA = () => {
    const texto = novoAssuntoPA.trim();
    if (!texto) {
      toast.error("Informe um assunto válido para adicionar.");
      return;
    }

    const chaveNova = texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const existe = form.assuntosPASindicancia.some((item) => {
      const chaveAtual = String(item)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return chaveAtual === chaveNova;
    });

    if (existe) {
      toast.error("Este assunto já existe na lista.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      assuntosPASindicancia: [...prev.assuntosPASindicancia, texto],
    }));
    setNovoAssuntoPA("");
  };

  const handleDragStartPA = (event: DragStartEvent) => {
    setDragAssuntoPAId(String(event.active.id));
  };

  const handleDragCancelPA = () => {
    setDragAssuntoPAId(null);
  };

  const handleDragEndPA = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDragAssuntoPAId(null);
      return;
    }

    const oldIndex = Number(String(active.id).replace("pa-", ""));
    const newIndex = Number(String(over.id).replace("pa-", ""));
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;

    setForm((prev) => ({
      ...prev,
      assuntosPASindicancia: arrayMove(prev.assuntosPASindicancia, oldIndex, newIndex),
    }));
    setDragAssuntoPAId(null);
  };

  const updateAssuntoDU = (index: number, value: string) => {
    setForm((prev) => {
      const lista = [...prev.assuntosDUPrincipais];
      lista[index] = value;
      return {
        ...prev,
        assuntosDUPrincipais: lista,
      };
    });
  };

  const removeAssuntoDU = (index: number) => {
    setForm((prev) => ({
      ...prev,
      assuntosDUPrincipais: prev.assuntosDUPrincipais.filter((_, i) => i !== index),
    }));
  };

  const addAssuntoDU = () => {
    const texto = novoAssuntoDU.trim();
    if (!texto) {
      toast.error("Informe um assunto válido para adicionar.");
      return;
    }

    const chaveNova = texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const existe = form.assuntosDUPrincipais.some((item) => {
      const chaveAtual = String(item)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return chaveAtual === chaveNova;
    });

    if (existe) {
      toast.error("Este assunto já existe na lista.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      assuntosDUPrincipais: [...prev.assuntosDUPrincipais, texto],
    }));
    setNovoAssuntoDU("");
  };

  const handleDragStartDU = (event: DragStartEvent) => {
    setDragAssuntoDUId(String(event.active.id));
  };

  const handleDragCancelDU = () => {
    setDragAssuntoDUId(null);
  };

  const handleDragEndDU = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setDragAssuntoDUId(null);
      return;
    }

    const oldIndex = Number(String(active.id).replace("du-", ""));
    const newIndex = Number(String(over.id).replace("du-", ""));
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;

    setForm((prev) => ({
      ...prev,
      assuntosDUPrincipais: arrayMove(prev.assuntosDUPrincipais, oldIndex, newIndex),
    }));
    setDragAssuntoDUId(null);
  };

  const processualFields: Array<keyof ProcessualDeadlineSettings> = [
    "prazoIPMInicialDias",
    "prazoIPMProrrogacaoDias",
    "prazoSindicanciaInicialDias",
    "prazoSindicanciaProrrogacaoDias",
    "prazoConselhoInicialDias",
    "prazoConselhoProrrogacaoDias",
  ];

  const updatePAFlowAction = (index: number, patch: Partial<PAFlowActionSetting>) => {
    setForm((prev) => {
      const lista = [...prev.paFlowActions];
      lista[index] = {
        ...lista[index],
        ...patch,
      };
      return {
        ...prev,
        paFlowActions: lista,
      };
    });
  };

  const removePAFlowAction = (index: number) => {
    setForm((prev) => ({
      ...prev,
      paFlowActions: prev.paFlowActions.filter((_, i) => i !== index),
    }));
  };

  const addPAFlowAction = (track: PAFlowTrack = "padrao") => {
    const maiorOrdem = form.paFlowActions.reduce((max, item) => {
      const atual = Number(item.order || 0);
      return atual > max ? atual : max;
    }, 0);

    const novaAcao: PAFlowActionSetting = {
      id: `PA_CUSTOM_${Date.now()}`,
      label: "Nova ação PA",
      fromState: "EM_CURSO",
      toState: "AGUARDANDO_CHEFIA_SOLUCAO",
      role: "assessor_pa",
      track,
      enabled: true,
      order: maiorOrdem + 10,
    };

    setForm((prev) => ({
      ...prev,
      paFlowActions: [...prev.paFlowActions, novaAcao],
    }));
  };

  const paFlowActionsComIndice = useMemo(
    () => form.paFlowActions.map((acao, index) => ({ acao, index })),
    [form.paFlowActions],
  );

  const paFlowEditGroups = useMemo(() => ({
    padrao: paFlowActionsComIndice
      .filter(({ acao }) => acao.track === "padrao")
      .sort((a, b) => a.acao.order - b.acao.order),
    conselho: paFlowActionsComIndice
      .filter(({ acao }) => acao.track === "conselho")
      .sort((a, b) => a.acao.order - b.acao.order),
    todos: paFlowActionsComIndice
      .filter(({ acao }) => acao.track === "todos")
      .sort((a, b) => a.acao.order - b.acao.order),
  }), [paFlowActionsComIndice]);

  const paFlowVisual = useMemo(() => {
    const base = form.paFlowActions
      .map((acao, index) => ({ acao, index }))
      .filter(({ acao }) => acao.enabled)
      .sort((a, b) => a.acao.order - b.acao.order);

    return {
      padrao: base.filter(({ acao }) => acao.track === "padrao"),
      conselho: base.filter(({ acao }) => acao.track === "conselho"),
    };
  }, [form.paFlowActions]);

  const selectedFlowAction = useMemo(() => {
    if (selectedFlowActionIndex === null) return null;
    if (selectedFlowActionIndex < 0 || selectedFlowActionIndex >= form.paFlowActions.length) return null;
    const acao = form.paFlowActions[selectedFlowActionIndex];
    return { acao, index: selectedFlowActionIndex };
  }, [form.paFlowActions, selectedFlowActionIndex]);

  useEffect(() => {
    if (selectedFlowActionIndex === null) return;
    requestAnimationFrame(() => {
      selectedFlowEditorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [selectedFlowActionIndex]);

  const aplicarFluxoAutomaticoPorTrilha = (
    track: PAFlowTrack,
    lista: PAFlowActionSetting[],
  ): PAFlowActionSetting[] => {
    if (track === "todos") {
      return lista.map((item, index) => ({
        ...item,
        order: (index + 1) * 10,
      }));
    }

    const sequencia = PA_FLOW_SEQUENCE_BY_TRACK[track];
    const ultimoEstado = sequencia[sequencia.length - 1];
    const penultimoEstado = sequencia[Math.max(sequencia.length - 2, 0)];

    return lista.map((item, index) => {
      const from = sequencia[index] || penultimoEstado;
      const to = sequencia[index + 1] || ultimoEstado;
      return {
        ...item,
        track,
        fromState: from,
        toState: to,
        order: (index + 1) * 10,
      };
    });
  };

  const handlePAFlowDragEnd = (track: PAFlowTrack, event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = Number(String(active.id).split("-").pop());
    const overIndex = Number(String(over.id).split("-").pop());
    if (Number.isNaN(activeIndex) || Number.isNaN(overIndex)) return;

    setForm((prev) => {
      const lista = [...prev.paFlowActions];
      const indicesGrupo = lista
        .map((acao, index) => ({ acao, index }))
        .filter(({ acao }) => acao.track === track)
        .sort((a, b) => a.acao.order - b.acao.order)
        .map(({ index }) => index);

      const origemNoGrupo = indicesGrupo.indexOf(activeIndex);
      const destinoNoGrupo = indicesGrupo.indexOf(overIndex);
      if (origemNoGrupo < 0 || destinoNoGrupo < 0) return prev;

      const ordemIndices = arrayMove(indicesGrupo, origemNoGrupo, destinoNoGrupo);
      const reordenadas = ordemIndices.map((index) => lista[index]);
      const normalizadas = aplicarFluxoAutomaticoPorTrilha(track, reordenadas);

      ordemIndices.forEach((indexOriginal, posicao) => {
        lista[indexOriginal] = normalizadas[posicao];
      });

      return {
        ...prev,
        paFlowActions: lista,
      };
    });
  };

  const renderPAFlowEditorGroup = (
    titulo: string,
    descricao: string,
    itens: Array<{ acao: PAFlowActionSetting; index: number }>,
    emptyLabel: string,
    trackPadrao: PAFlowTrack,
    showHeader = true,
  ) => (
    <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
      {showHeader && (
        <div>
          <h5 className="text-xs font-bold uppercase tracking-wide text-slate-700">{titulo}</h5>
          <p className="mt-1 text-[11px] text-muted-foreground">{descricao}</p>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-background px-3 py-2 text-xs text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {itens.map(({ acao, index }) => (
            <div key={`${acao.id}-${index}`} className="rounded-xl border border-border bg-background p-3 space-y-3">
              {modoPAAvancado ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>ID da Ação</Label>
                      <Input
                        value={acao.id}
                        onChange={(e) => updatePAFlowAction(index, { id: e.target.value })}
                        placeholder="ID único da ação"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Rótulo da Ação</Label>
                      <Input
                        value={acao.label}
                        onChange={(e) => updatePAFlowAction(index, { label: e.target.value })}
                        placeholder="Texto exibido no botão"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label>Estado Atual</Label>
                      <select
                        value={acao.fromState}
                        onChange={(e) => updatePAFlowAction(index, { fromState: e.target.value as PAFlowState })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_STATES.map((estado) => (
                          <option key={`from-${estado}`} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Próximo Estado</Label>
                      <select
                        value={acao.toState}
                        onChange={(e) => updatePAFlowAction(index, { toState: e.target.value as PAFlowState })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_STATES.map((estado) => (
                          <option key={`to-${estado}`} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Perfil</Label>
                      <select
                        value={acao.role}
                        onChange={(e) => updatePAFlowAction(index, { role: e.target.value as PAFlowRole })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_ROLE_OPTIONS.map((opt) => (
                          <option key={`role-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Trilha</Label>
                      <select
                        value={acao.track}
                        onChange={(e) => updatePAFlowAction(index, { track: e.target.value as PAFlowTrack })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_TRACK_OPTIONS.map((opt) => (
                          <option key={`track-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Ordem</Label>
                      <Input
                        type="number"
                        min={0}
                        value={acao.order}
                        onChange={(e) => updatePAFlowAction(index, { order: Number(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={acao.enabled}
                          onChange={(e) => updatePAFlowAction(index, { enabled: e.target.checked })}
                        />
                        Ação habilitada
                      </label>

                      <Button type="button" variant="outline" onClick={() => removePAFlowAction(index)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label>Nome da Ação</Label>
                    <Input
                      value={acao.label}
                      onChange={(e) => updatePAFlowAction(index, { label: e.target.value })}
                      placeholder="Texto exibido no botão"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>De (estado atual)</Label>
                      <select
                        value={acao.fromState}
                        onChange={(e) => updatePAFlowAction(index, { fromState: e.target.value as PAFlowState, track: trackPadrao })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_STATES.map((estado) => (
                          <option key={`from-simple-${estado}`} value={estado}>{PA_FLOW_STATE_LABELS[estado]}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Para (próximo estado)</Label>
                      <select
                        value={acao.toState}
                        onChange={(e) => updatePAFlowAction(index, { toState: e.target.value as PAFlowState, track: trackPadrao })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_STATES.map((estado) => (
                          <option key={`to-simple-${estado}`} value={estado}>{PA_FLOW_STATE_LABELS[estado]}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Quem executa</Label>
                      <select
                        value={acao.role}
                        onChange={(e) => updatePAFlowAction(index, { role: e.target.value as PAFlowRole, track: trackPadrao })}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {PA_FLOW_ROLE_OPTIONS.map((opt) => (
                          <option key={`role-simple-${opt.value}`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={acao.enabled}
                        onChange={(e) => updatePAFlowAction(index, { enabled: e.target.checked, track: trackPadrao })}
                      />
                      Ação habilitada
                    </label>

                    <Button type="button" variant="outline" onClick={() => removePAFlowAction(index)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </Button>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    ID, ordem e trilha são corrigidos automaticamente ao salvar.
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
    setNovoAssuntoPA("");
    setNovoAssuntoDU("");
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

    const assuntosPASindicancia = normalizarAssuntosPA(
      form.assuntosPASindicancia,
      DEFAULT_ASSUNTOS_PA_SINDICANCIA,
    );

    const assuntosDUPrincipais = normalizarAssuntosDU(
      form.assuntosDUPrincipais,
      DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
    );

    const gerarIdSeguro = (valor: string, fallback: string) => {
      const base = (valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      return base || fallback;
    };

    const idsUsados = new Set<string>();
    const tracks: PAFlowTrack[] = ["padrao", "conselho", "todos"];
    const paFlowActionsPreparadas: PAFlowActionSetting[] = [];

    tracks.forEach((track) => {
      const daTrilha = form.paFlowActions
        .filter((acao) => acao.track === track)
        .sort((a, b) => a.order - b.order)
        .map((acao, index) => {
          const fallbackId = `ACAO_PA_${track.toUpperCase()}_${index + 1}`;
          const idBase = gerarIdSeguro(acao.id || acao.label, fallbackId);
          let idFinal = idBase;
          let sufixo = 2;

          while (idsUsados.has(idFinal)) {
            idFinal = `${idBase}_${sufixo}`;
            sufixo += 1;
          }
          idsUsados.add(idFinal);

          return {
            ...acao,
            id: idFinal,
            label: String(acao.label || "").trim() || `Ação ${index + 1}`,
            track,
          };
        });

      const normalizadaTrilha = aplicarFluxoAutomaticoPorTrilha(track, daTrilha);
      paFlowActionsPreparadas.push(...normalizadaTrilha);
    });

    const paFlowActions = normalizarPAFlowActions(paFlowActionsPreparadas, DEFAULT_PA_FLOW_ACTIONS);

    if (assuntosPASindicancia.length === 0) {
      toast.error("Mantenha ao menos um assunto de PA para o cadastro.");
      return;
    }

    if (assuntosDUPrincipais.length === 0) {
      toast.error("Mantenha ao menos um assunto de DU para o cadastro.");
      return;
    }

    if (paFlowActions.length === 0) {
      toast.error("Mantenha ao menos uma ação no fluxo PA.");
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
        assuntosPASindicancia,
        assuntosDUPrincipais,
        paFlowActions,
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
          <Collapsible open={openGeral} onOpenChange={setOpenGeral}>
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    <Type className="h-4 w-4 text-[var(--tipo-pa)]" />
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
                      <Type className="h-4 w-4 text-[var(--tipo-pa)]" />
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
                      <MonitorCog className="h-4 w-4 text-[var(--tipo-pa)]" />
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
                      <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
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

          <Collapsible open={openPA} onOpenChange={setOpenPA}>
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                    <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                    Setor PA
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Assuntos de PA e prazos processuais de Sindicância, IPM e Conselhos.
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPA ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-4 space-y-5">
                <Collapsible open={openPAAssuntos} onOpenChange={setOpenPAAssuntos}>
                  <section className="space-y-4">
                    <CollapsibleTrigger className="flex w-full items-center justify-between text-left">
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                          <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                          Assuntos de PA (Sindicância)
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Lista usada no dropdown de assunto quando o tipo de procedimento for Sindicância.
                        </p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPAAssuntos ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2">
                      <div className="space-y-3">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleDragStartPA}
                          onDragCancel={handleDragCancelPA}
                          onDragEnd={handleDragEndPA}
                        >
                          <SortableContext items={assuntoPAIds} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                              {form.assuntosPASindicancia.map((assunto, index) => (
                                <SortableAssuntoRow
                                  key={assuntoPAIds[index]}
                                  id={assuntoPAIds[index]}
                                  value={assunto}
                                  placeholder="Digite o assunto"
                                  onChange={(value) => updateAssuntoPA(index, value)}
                                  onDelete={() => removeAssuntoPA(index)}
                                />
                              ))}
                            </div>
                          </SortableContext>
                          <DragOverlay>
                            {dragAssuntoPALabel ? <AssuntoDragPreview label={dragAssuntoPALabel} /> : null}
                          </DragOverlay>
                        </DndContext>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            value={novoAssuntoPA}
                            onChange={(e) => setNovoAssuntoPA(e.target.value)}
                            placeholder="Novo assunto PA"
                          />
                          <Button type="button" variant="secondary" onClick={addAssuntoPA} className="shrink-0">
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
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPAPrazos ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2">
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
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openPAFluxo ? "rotate-180" : ""}`} />
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
                          Arraste as ações aqui para reordenar o fluxo automaticamente.
                        </p>

                        <div className="grid gap-3 xl:grid-cols-2">
                          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Sindicância / IPM</p>
                            {paFlowVisual.padrao.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhuma ação habilitada nesta trilha.</p>
                            ) : (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handlePAFlowDragEnd("padrao", event)}
                              >
                                <SortableContext
                                  items={paFlowVisual.padrao.map(({ index }) => `pa-flow-visual-padrao-${index}`)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-2">
                                    {paFlowVisual.padrao.map(({ acao, index }) => (
                                      <SortableFlowActionCard
                                        key={`flow-padrao-${acao.id}`}
                                        id={`pa-flow-visual-padrao-${index}`}
                                        onClick={() => setSelectedFlowActionIndex(index)}
                                        selected={selectedFlowActionIndex === index}
                                      >
                                        <div className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                                          <p className="font-semibold text-slate-800">{acao.label}</p>
                                          <div className="mt-1 flex items-center gap-1 text-slate-600">
                                            <span>{PA_FLOW_STATE_LABELS[acao.fromState]}</span>
                                            <ArrowRight className="h-3 w-3" />
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

                          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">Conselhos</p>
                            {paFlowVisual.conselho.length === 0 ? (
                              <p className="text-xs text-muted-foreground">Nenhuma ação habilitada nesta trilha.</p>
                            ) : (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handlePAFlowDragEnd("conselho", event)}
                              >
                                <SortableContext
                                  items={paFlowVisual.conselho.map(({ index }) => `pa-flow-visual-conselho-${index}`)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-2">
                                    {paFlowVisual.conselho.map(({ acao, index }) => (
                                      <SortableFlowActionCard
                                        key={`flow-conselho-${acao.id}`}
                                        id={`pa-flow-visual-conselho-${index}`}
                                        onClick={() => setSelectedFlowActionIndex(index)}
                                        selected={selectedFlowActionIndex === index}
                                      >
                                        <div className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
                                          <p className="font-semibold text-slate-800">{acao.label}</p>
                                          <div className="mt-1 flex items-center gap-1 text-slate-600">
                                            <span>{PA_FLOW_STATE_LABELS[acao.fromState]}</span>
                                            <ArrowRight className="h-3 w-3" />
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
                        <div ref={selectedFlowEditorRef} className="rounded-2xl border border-sky-200 bg-sky-50/30 p-3 space-y-2">
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
                          <Button type="button" variant="secondary" onClick={() => addPAFlowAction("padrao")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova ação de Sindicância/IPM
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => addPAFlowAction("conselho")}>
                            <Plus className="mr-2 h-4 w-4" />
                            Nova ação de Conselhos
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => addPAFlowAction("todos")}>
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
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openDU ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>

              <CollapsibleContent className="pt-4">
                <section className="space-y-4">
                  <div>
                    <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700">
                      <Settings2 className="h-4 w-4 text-[var(--tipo-pa)]" />
                      Assuntos DU no Cadastro
                    </h4>
                  </div>

                  <div className="space-y-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStartDU}
                      onDragCancel={handleDragCancelDU}
                      onDragEnd={handleDragEndDU}
                    >
                      <SortableContext items={assuntoDUIds} strategy={verticalListSortingStrategy}>
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
                        {dragAssuntoDULabel ? <AssuntoDragPreview label={dragAssuntoDULabel} /> : null}
                      </DragOverlay>
                    </DndContext>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={novoAssuntoDU}
                        onChange={(e) => setNovoAssuntoDU(e.target.value)}
                        placeholder="Novo assunto DU"
                      />
                      <Button type="button" variant="secondary" onClick={addAssuntoDU} className="shrink-0">
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </section>
              </CollapsibleContent>
            </div>
          </Collapsible>

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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