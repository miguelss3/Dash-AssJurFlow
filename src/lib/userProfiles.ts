import type { AuthUser } from "@/hooks/useAuth";

export function normalizarSetorUsuario(valor: unknown): "DU" | "PA" | "" {
  const texto = String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (!texto) return "";
  if (texto === "DU" || texto.includes("DEFESA") || texto.includes("USUARIO")) return "DU";
  if (texto === "PA" || texto.includes("PROCESSO") || texto.includes("ADMIN")) return "PA";
  return "";
}

export interface UsuarioPrivado extends AuthUser {
  uid: string;
  email: string;
  ativo?: boolean;
  atualizadoEm?: string;
}

export interface UsuarioPublico {
  uid: string;
  posto: string;
  nome: string;
  nomeGuerra?: string;
  setor: string;
  ativo?: boolean;
  atualizadoEm?: string;
}

export function criarUsuarioPublico(dados: Partial<UsuarioPrivado>): UsuarioPublico {
  const setorNormalizado = normalizarSetorUsuario(dados.setor || dados.secao);
  return {
    uid: String(dados.uid || ""),
    posto: String(dados.posto || ""),
    nome: String(dados.nome || dados.nomeGuerra || "Usuário"),
    nomeGuerra: dados.nomeGuerra ? String(dados.nomeGuerra) : undefined,
    setor: setorNormalizado,
    ativo: dados.ativo !== false,
    atualizadoEm: dados.atualizadoEm,
  };
}

export function nomeMilitarUsuario(dados: {
  posto?: string;
  nome?: string;
  nomeGuerra?: string;
  email?: string;
}): string {
  const nomeBase = dados.nomeGuerra || dados.nome || dados.email?.split("@")[0] || "Usuário";
  return dados.posto ? `${dados.posto} ${nomeBase}`.trim() : nomeBase;
}