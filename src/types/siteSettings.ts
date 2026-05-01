export interface ProcessualDeadlineSettings {
  prazoIPMInicialDias: number;
  prazoIPMProrrogacaoDias: number;
  prazoSindicanciaInicialDias: number;
  prazoSindicanciaProrrogacaoDias: number;
  prazoConselhoInicialDias: number;
  prazoConselhoProrrogacaoDias: number;
}

export type PAInProgressColumnId = "sindicancia" | "ipm" | "conselho";

export interface PAInProgressColumnSetting {
  id: PAInProgressColumnId;
  label: string;
  enabled: boolean;
  order: number;
}

export type DUBoardColumnId = "aguardando_resposta" | "aguardando_distribuicao" | "aguardando_assinatura";

export interface DUBoardColumnSetting {
  id: DUBoardColumnId;
  label: string;
  enabled: boolean;
  order: number;
}

export type ColumnTabId = "portaria_assinada" | "andamento" | "atraso" | "concluidos";

export interface ColumnTabSetting {
  id: ColumnTabId;
  label: string;
  enabled: boolean;
  order: number;
  scope: "PA" | "DU";
}

export type PAFlowRole = "assessor_pa" | "chefe_assjur" | "ambos";

export type PAFlowTrack = "padrao" | "conselho" | "todos";

export type PAFlowState =
  | "MESA_ASSESSOR_NOVO"
  | "AGUARDANDO_CHEFIA"
  | "AGUARDANDO_PRAZO"
  | "EM_CURSO"
  | "AGUARDANDO_CHEFIA_SOLUCAO"
  | "APTO_FINALIZAR"
  | "C_MEMORIA"
  | "C_PORTARIA"
  | "C_EM_CURSO"
  | "C_DECISAO_AUT_NOMEANTE"
  | "C_INTIMACAO_ACUSADO"
  | "C_ENCAMINHAMENTO_CMTEX"
  | "C_DECISAO_CMTEX"
  | "CONCLUIDO";

export interface PAFlowActionSetting {
  id: string;
  label: string;
  fromState: PAFlowState;
  toState: PAFlowState;
  role: PAFlowRole;
  track: PAFlowTrack;
  enabled: boolean;
  order: number;
}

export interface SiteSettings extends ProcessualDeadlineSettings {
  sidebarTitle: string;
  sidebarSubtitle: string;
  dashboardTitle: string;
  dashboardDescription: string;
  newProcessLabel: string;
  footerText: string;
  assuntosPASindicancia: string[];
  assuntosDUPrincipais: string[];
  origensDUDocumentos: string[];
  secoesDU: string[];
  paEmAndamentoColumns: PAInProgressColumnSetting[];
  duBoardColumns: DUBoardColumnSetting[];
  columnTabs: ColumnTabSetting[];
  paFlowActions: PAFlowActionSetting[];
  updatedAt?: string;
  updatedByName?: string;
  updatedByEmail?: string;
}

export const SITE_SETTINGS_DOC_ID = "layoutPrincipal";

export const DEFAULT_PROCESSUAL_DEADLINES: ProcessualDeadlineSettings = {
  prazoIPMInicialDias: 40,
  prazoIPMProrrogacaoDias: 20,
  prazoSindicanciaInicialDias: 30,
  prazoSindicanciaProrrogacaoDias: 20,
  prazoConselhoInicialDias: 30,
  prazoConselhoProrrogacaoDias: 20,
};

export const DEFAULT_ASSUNTOS_DU_PRINCIPAIS = [
  "Saúde e FUSEx",
  "Movimentação e Transferência",
  "SFPC / CAC",
  "Carreira e Remuneração",
  "Disciplina e Justiça",
  "Licitações e Contratos",
];

export const DEFAULT_ORIGENS_DU_DOCUMENTOS = [
  "SAPIENS",
  "Email",
  "MPF",
  "Justiça Federal",
  "Justiça Estadual",
  "Outros",
];

export const DEFAULT_SECOES_DU = [
  "SVP",
  "SSIP",
  "SALC",
  "Sec Pessoal",
  "OUTROS",
];

export const DEFAULT_ASSUNTOS_PA_SINDICANCIA = [
  "Apuração de Fato",
  "Dano ao Erário",
  "Despesa de Exercícios Anteriores",
  "Exame de Pagamento",
  "FUSEx",
  "Transgressão Disciplinar",
  "OUTROS",
];

export const DEFAULT_PA_EM_ANDAMENTO_COLUMNS: PAInProgressColumnSetting[] = [
  {
    id: "sindicancia",
    label: "📗 Sindicancias",
    enabled: true,
    order: 10,
  },
  {
    id: "ipm",
    label: "📘 IPM",
    enabled: true,
    order: 20,
  },
  {
    id: "conselho",
    label: "⚖ Conselhos",
    enabled: true,
    order: 30,
  },
];

export const DEFAULT_DU_BOARD_COLUMNS: DUBoardColumnSetting[] = [
  // Ordem do Kanban DU (V2.4): Mesa do Assessor e Mesa do Chefe são
  // colunas fixas renderizadas pelo board; aqui ficam as colunas configuráveis
  // que aparecem à direita.
  // 1ª configurável: Aguardando Distribuição.
  // 2ª configurável (= 4ª global): Aguardando Assinatura — logo à direita
  //   da Mesa do Chefe e antes de Aguardando Resposta.
  // 3ª configurável: Aguardando Resposta.
  {
    id: "aguardando_distribuicao",
    label: "📥 Aguardando Distribuicao",
    enabled: true,
    order: 10,
  },
  {
    id: "aguardando_assinatura",
    label: "✍️ Aguardando Assinatura",
    enabled: true,
    order: 20,
  },
  {
    id: "aguardando_resposta",
    label: "📩 Aguardando Resposta",
    enabled: true,
    order: 30,
  },
];

export const DEFAULT_COLUMN_TABS: ColumnTabSetting[] = [
  {
    id: "portaria_assinada",
    label: "Portaria Assinada",
    enabled: true,
    order: 5,
    scope: "PA",
  },
  {
    id: "andamento",
    label: "No Prazo",
    enabled: true,
    order: 10,
    scope: "PA",
  },
  {
    id: "atraso",
    label: "Em Atraso",
    enabled: true,
    order: 20,
    scope: "PA",
  },
  {
    id: "concluidos",
    label: "Finalizados",
    enabled: true,
    order: 30,
    scope: "PA",
  },
  {
    id: "andamento",
    label: "No Prazo",
    enabled: true,
    order: 10,
    scope: "DU",
  },
  {
    id: "concluidos",
    label: "Finalizados",
    enabled: true,
    order: 20,
    scope: "DU",
  },
];

export const DEFAULT_PA_FLOW_ACTIONS: PAFlowActionSetting[] = [
  {
    id: "PA_ENVIAR_CHEFIA",
    label: "Enviar para a Chefia da AssJur",
    fromState: "MESA_ASSESSOR_NOVO",
    toState: "AGUARDANDO_CHEFIA",
    role: "assessor_pa",
    track: "padrao",
    enabled: true,
    order: 10,
  },
  {
    id: "PA_CHEFIA_CONFIRMA_ASSINATURA",
    label: "Confirmar Assinatura e Devolver",
    fromState: "AGUARDANDO_CHEFIA",
    toState: "AGUARDANDO_PRAZO",
    role: "chefe_assjur",
    track: "padrao",
    enabled: true,
    order: 20,
  },
  {
    id: "PA_INICIAR_PRAZO",
    label: "Confirmar Data e Iniciar Prazo",
    fromState: "AGUARDANDO_PRAZO",
    toState: "EM_CURSO",
    role: "assessor_pa",
    track: "padrao",
    enabled: true,
    order: 30,
  },
  {
    id: "PA_ENVIAR_SOLUCAO",
    label: "Elaborar Solucao e Enviar a Chefia",
    fromState: "EM_CURSO",
    toState: "AGUARDANDO_CHEFIA_SOLUCAO",
    role: "assessor_pa",
    track: "padrao",
    enabled: true,
    order: 40,
  },
  {
    id: "PA_CHEFIA_CONFIRMA_DESPACHO",
    label: "Confirmar Despacho e Devolver",
    fromState: "AGUARDANDO_CHEFIA_SOLUCAO",
    toState: "APTO_FINALIZAR",
    role: "chefe_assjur",
    track: "padrao",
    enabled: true,
    order: 50,
  },
  {
    id: "PA_FINALIZAR_PADRAO",
    label: "Registrar Despachos e Finalizar",
    fromState: "APTO_FINALIZAR",
    toState: "CONCLUIDO",
    role: "assessor_pa",
    track: "padrao",
    enabled: true,
    order: 60,
  },
  {
    id: "C_ENVIAR_MEMORIA",
    label: "Elaborar Memoria e Enviar a Chefia",
    fromState: "C_MEMORIA",
    toState: "C_PORTARIA",
    role: "assessor_pa",
    track: "conselho",
    enabled: true,
    order: 70,
  },
  {
    id: "C_CHEFIA_ASSINA_PORTARIA",
    label: "Confirmar Assinatura e Instalar",
    fromState: "C_PORTARIA",
    toState: "C_EM_CURSO",
    role: "chefe_assjur",
    track: "conselho",
    enabled: true,
    order: 80,
  },
  {
    id: "C_ENVIAR_DECISAO_AUT",
    label: "Enviar para Decisao da Autoridade",
    fromState: "C_EM_CURSO",
    toState: "C_DECISAO_AUT_NOMEANTE",
    role: "assessor_pa",
    track: "conselho",
    enabled: true,
    order: 90,
  },
  {
    id: "C_AUT_NOMEANTE_DECIDE",
    label: "Exarar Decisao e Devolver ao Assessor",
    fromState: "C_DECISAO_AUT_NOMEANTE",
    toState: "C_INTIMACAO_ACUSADO",
    role: "chefe_assjur",
    track: "conselho",
    enabled: true,
    order: 100,
  },
  {
    id: "C_RECURSO_SIM",
    label: "Acusado apresentou recurso",
    fromState: "C_INTIMACAO_ACUSADO",
    toState: "C_ENCAMINHAMENTO_CMTEX",
    role: "assessor_pa",
    track: "conselho",
    enabled: true,
    order: 110,
  },
  {
    id: "C_RECURSO_NAO",
    label: "Acusado nao apresentou recurso",
    fromState: "C_INTIMACAO_ACUSADO",
    toState: "CONCLUIDO",
    role: "assessor_pa",
    track: "conselho",
    enabled: true,
    order: 120,
  },
  {
    id: "C_CONFIRMAR_REMESSA",
    label: "Confirmar Remessa ao Cmt Ex",
    fromState: "C_ENCAMINHAMENTO_CMTEX",
    toState: "C_DECISAO_CMTEX",
    role: "assessor_pa",
    track: "conselho",
    enabled: true,
    order: 130,
  },
  {
    id: "C_REGISTRAR_DECISAO_FINAL",
    label: "Registrar Decisao Final e Encerrar",
    fromState: "C_DECISAO_CMTEX",
    toState: "CONCLUIDO",
    role: "chefe_assjur",
    track: "conselho",
    enabled: true,
    order: 140,
  },
];

export function normalizarListaTextual(
  value: unknown,
  fallback: string[],
): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const unicos = new Set<string>();
  const mapaOriginal = new Map<string, string>();

  for (const item of value) {
    const texto = String(item ?? "").trim();
    if (!texto) continue;
    const chave = texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!unicos.has(chave)) {
      unicos.add(chave);
      mapaOriginal.set(chave, texto);
    }
  }

  const lista = Array.from(unicos.values())
    .map((chave) => mapaOriginal.get(chave) || "")
    .filter(Boolean);

  return lista.length > 0 ? lista : [...fallback];
}

export function normalizarAssuntosDU(
  value: unknown,
  fallback: string[] = DEFAULT_ASSUNTOS_DU_PRINCIPAIS,
): string[] {
  return normalizarListaTextual(value, fallback);
}

export function normalizarOrigensDUDocumentos(
  value: unknown,
  fallback: string[] = DEFAULT_ORIGENS_DU_DOCUMENTOS,
): string[] {
  return normalizarListaTextual(value, fallback);
}

export function normalizarSecoesDU(
  value: unknown,
  fallback: string[] = DEFAULT_SECOES_DU,
): string[] {
  return normalizarListaTextual(value, fallback);
}

export function normalizarAssuntosPA(
  value: unknown,
  fallback: string[] = DEFAULT_ASSUNTOS_PA_SINDICANCIA,
): string[] {
  return normalizarListaTextual(value, fallback);
}

export function normalizarPAEmAndamentoColumns(
  value: unknown,
  fallback: PAInProgressColumnSetting[] = DEFAULT_PA_EM_ANDAMENTO_COLUMNS,
): PAInProgressColumnSetting[] {
  const fallbackPorId = new Map<PAInProgressColumnId, PAInProgressColumnSetting>(
    fallback.map((item) => [item.id, item]),
  );
  const idsValidos = new Set<PAInProgressColumnId>(["sindicancia", "ipm", "conselho"]);

  if (!Array.isArray(value)) {
    return [...fallback].sort((a, b) => a.order - b.order);
  }

  const saneadas = value
    .map((item, index) => {
      const base = item as Partial<PAInProgressColumnSetting>;
      const id = base.id as PAInProgressColumnId;
      if (!idsValidos.has(id)) return null;

      const fallbackItem = fallbackPorId.get(id);
      const label = String(base.label || "").trim() || fallbackItem?.label || id;
      const enabled = base.enabled !== false;
      const order = Number.isFinite(Number(base.order))
        ? Number(base.order)
        : (index + 1) * 10;

      return {
        id,
        label,
        enabled,
        order,
      };
    })
    .filter((item): item is PAInProgressColumnSetting => !!item);

  const unicasPorId = new Map<PAInProgressColumnId, PAInProgressColumnSetting>();
  saneadas.forEach((item) => {
    if (!unicasPorId.has(item.id)) {
      unicasPorId.set(item.id, item);
    }
  });

  const idsPadrao: PAInProgressColumnId[] = ["sindicancia", "ipm", "conselho"];
  idsPadrao.forEach((id, index) => {
    if (!unicasPorId.has(id)) {
      const base = fallbackPorId.get(id) || fallback[index];
      if (base) {
        unicasPorId.set(id, {
          id,
          label: base.label,
          enabled: base.enabled !== false,
          order: base.order,
        });
      }
    }
  });

  return Array.from(unicasPorId.values()).sort((a, b) => a.order - b.order);
}

export function normalizarDUBoardColumns(
  value: unknown,
  fallback: DUBoardColumnSetting[] = DEFAULT_DU_BOARD_COLUMNS,
): DUBoardColumnSetting[] {
  const fallbackPorId = new Map<DUBoardColumnId, DUBoardColumnSetting>(
    fallback.map((item) => [item.id, item]),
  );
  const idsValidos = new Set<DUBoardColumnId>(["aguardando_resposta", "aguardando_distribuicao", "aguardando_assinatura"]);

  if (!Array.isArray(value)) {
    return [...fallback].sort((a, b) => a.order - b.order);
  }

  const saneadas = value
    .map((item, index) => {
      const base = item as Partial<DUBoardColumnSetting>;
      const id = base.id as DUBoardColumnId;
      if (!idsValidos.has(id)) return null;

      const fallbackItem = fallbackPorId.get(id);
      const label = String(base.label || "").trim() || fallbackItem?.label || id;
      const enabled = base.enabled !== false;
      const order = Number.isFinite(Number(base.order))
        ? Number(base.order)
        : (index + 1) * 10;

      return {
        id,
        label,
        enabled,
        order,
      };
    })
    .filter((item): item is DUBoardColumnSetting => !!item);

  const unicasPorId = new Map<DUBoardColumnId, DUBoardColumnSetting>();
  saneadas.forEach((item) => {
    if (!unicasPorId.has(item.id)) {
      unicasPorId.set(item.id, item);
    }
  });

  const idsPadrao: DUBoardColumnId[] = ["aguardando_resposta", "aguardando_assinatura", "aguardando_distribuicao"];
  idsPadrao.forEach((id, index) => {
    if (!unicasPorId.has(id)) {
      const base = fallbackPorId.get(id) || fallback[index];
      if (base) {
        unicasPorId.set(id, {
          id,
          label: base.label,
          enabled: base.enabled !== false,
          order: base.order,
        });
      }
    }
  });

  // V2.5 — Override defensivo: garante que "Aguardando Assinatura" exista,
  // esteja habilitada e fique como 4ª coluna global (logo após a Mesa do
  // Chefe). Resolve o caso de o Firestore ter sobrescrito o padrão antigo
  // (sem essa coluna) ou tê-la salvo desabilitada.
  const fallbackAssinatura = fallbackPorId.get("aguardando_assinatura");
  const labelAssinatura =
    unicasPorId.get("aguardando_assinatura")?.label
    || fallbackAssinatura?.label
    || "✍️ Aguardando Assinatura";
  unicasPorId.set("aguardando_assinatura", {
    id: "aguardando_assinatura",
    label: labelAssinatura,
    enabled: true,
    order: 15,
  });

  return Array.from(unicasPorId.values()).sort((a, b) => a.order - b.order);
}

export function normalizarColumnTabs(
  value: unknown,
  fallback: ColumnTabSetting[] = DEFAULT_COLUMN_TABS,
): ColumnTabSetting[] {
  const scopes: Array<"PA" | "DU"> = ["PA", "DU"];
  const idsValidos = new Set<ColumnTabId>(["portaria_assinada", "andamento", "atraso", "concluidos"]);
  const scopesValidos = new Set<"PA" | "DU">(scopes);

  const fallbackMap = new Map<string, ColumnTabSetting>();
  fallback.forEach((item) => {
    fallbackMap.set(`${item.scope}:${item.id}`, item);
  });

  if (!Array.isArray(value)) {
    return [...fallback].sort((a, b) => a.order - b.order);
  }

  const saneadas = value
    .map((item, index) => {
      const base = item as Partial<ColumnTabSetting>;
      const id = base.id as ColumnTabId;
      const scope = base.scope as "PA" | "DU";

      if (!idsValidos.has(id)) return null;
      if (!scopesValidos.has(scope)) return null;
      if (scope === "DU" && (id === "atraso" || id === "portaria_assinada")) return null;

      const fallbackItem = fallbackMap.get(`${scope}:${id}`);
      const label = String(base.label || "").trim() || fallbackItem?.label || id;
      const enabled = base.enabled !== false;
      const order = Number.isFinite(Number(base.order)) ? Number(base.order) : (index + 1) * 10;

      return {
        id,
        label,
        enabled,
        order,
        scope,
      };
    })
    .filter((item): item is ColumnTabSetting => !!item);

  const unicas = new Map<string, ColumnTabSetting>();
  saneadas.forEach((item) => {
    const key = `${item.scope}:${item.id}`;
    if (!unicas.has(key)) {
      unicas.set(key, item);
    }
  });

  fallback.forEach((item) => {
    const key = `${item.scope}:${item.id}`;
    if (!unicas.has(key)) {
      unicas.set(key, item);
    }
  });

  return Array.from(unicas.values()).sort((a, b) => a.order - b.order);
}

export function normalizarPAFlowActions(
  value: unknown,
  fallback: PAFlowActionSetting[] = DEFAULT_PA_FLOW_ACTIONS,
): PAFlowActionSetting[] {
  if (!Array.isArray(value)) {
    return [...fallback].sort((a, b) => a.order - b.order);
  }

  const estadosValidos = new Set<PAFlowState>([
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
  ]);
  const rolesValidos = new Set<PAFlowRole>(["assessor_pa", "chefe_assjur", "ambos"]);
  const trilhasValidas = new Set<PAFlowTrack>(["padrao", "conselho", "todos"]);

  const saneadas: PAFlowActionSetting[] = value
    .map((item, index) => {
      const base = item as Partial<PAFlowActionSetting>;
      const id = String(base.id || "").trim() || `acao_pa_${index + 1}`;
      const label = String(base.label || "").trim() || `Acao ${index + 1}`;
      const fromState = base.fromState;
      const toState = base.toState;
      const role = base.role;
      const track = base.track;

      if (!estadosValidos.has(fromState as PAFlowState)) return null;
      if (!estadosValidos.has(toState as PAFlowState)) return null;
      if (!rolesValidos.has(role as PAFlowRole)) return null;
      if (!trilhasValidas.has(track as PAFlowTrack)) return null;

      return {
        id,
        label,
        fromState: fromState as PAFlowState,
        toState: toState as PAFlowState,
        role: role as PAFlowRole,
        track: track as PAFlowTrack,
        enabled: base.enabled !== false,
        order: Number.isFinite(Number(base.order)) ? Number(base.order) : (index + 1) * 10,
      };
    })
    .filter((item): item is PAFlowActionSetting => !!item);

  if (saneadas.length === 0) {
    return [...fallback].sort((a, b) => a.order - b.order);
  }

  const ids = new Set<string>();
  const unicas = saneadas.filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });

  return unicas.sort((a, b) => a.order - b.order);
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  ...DEFAULT_PROCESSUAL_DEADLINES,
  sidebarTitle: "AssJur Flow",
  sidebarSubtitle: "12ª Região Militar",
  dashboardTitle: "Painel de Controle",
  dashboardDescription: "Mesa de trabalho e acompanhamento dos processos em andamento",
  newProcessLabel: "Novo Processo",
  footerText: "Maj Cav Miguel — AssJur Flow · 12ª Região Militar · Todos os direitos reservados.",
  assuntosPASindicancia: [...DEFAULT_ASSUNTOS_PA_SINDICANCIA],
  assuntosDUPrincipais: [...DEFAULT_ASSUNTOS_DU_PRINCIPAIS],
  origensDUDocumentos: [...DEFAULT_ORIGENS_DU_DOCUMENTOS],
  secoesDU: [...DEFAULT_SECOES_DU],
  paEmAndamentoColumns: [...DEFAULT_PA_EM_ANDAMENTO_COLUMNS],
  duBoardColumns: [...DEFAULT_DU_BOARD_COLUMNS],
  columnTabs: [...DEFAULT_COLUMN_TABS],
  paFlowActions: [...DEFAULT_PA_FLOW_ACTIONS],
};