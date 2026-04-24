export interface ProcessualDeadlineSettings {
  prazoIPMInicialDias: number;
  prazoIPMProrrogacaoDias: number;
  prazoSindicanciaInicialDias: number;
  prazoSindicanciaProrrogacaoDias: number;
  prazoConselhoInicialDias: number;
  prazoConselhoProrrogacaoDias: number;
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

export const DEFAULT_ASSUNTOS_PA_SINDICANCIA = [
  "Apuração de Fato",
  "Dano ao Erário",
  "Despesa de Exercícios Anteriores",
  "Exame de Pagamento",
  "FUSEx",
  "Transgressão Disciplinar",
  "OUTROS",
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

export function normalizarAssuntosPA(
  value: unknown,
  fallback: string[] = DEFAULT_ASSUNTOS_PA_SINDICANCIA,
): string[] {
  return normalizarListaTextual(value, fallback);
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
  paFlowActions: [...DEFAULT_PA_FLOW_ACTIONS],
};