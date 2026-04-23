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

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  ...DEFAULT_PROCESSUAL_DEADLINES,
  sidebarTitle: "AssJur Flow",
  sidebarSubtitle: "12ª Região Militar",
  dashboardTitle: "Painel de Controle",
  dashboardDescription: "Mesa de trabalho e acompanhamento dos processos em andamento",
  newProcessLabel: "Novo Processo",
  footerText: "Maj Cav Miguel — AssJur Flow · 12ª Região Militar · Todos os direitos reservados.",
};