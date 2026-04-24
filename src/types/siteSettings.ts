export interface ProcessualDeadlineSettings {
  prazoIPMInicialDias: number;
  prazoIPMProrrogacaoDias: number;
  prazoSindicanciaInicialDias: number;
  prazoSindicanciaProrrogacaoDias: number;
  prazoConselhoInicialDias: number;
  prazoConselhoProrrogacaoDias: number;
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
};