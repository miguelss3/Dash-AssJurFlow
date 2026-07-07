import { useEffect, useState } from "react";
import type { Processo, StatusProcesso, FiltroPrazo } from "@/types/processo";
import { MesaDU } from "./MesaDU";
import { MesaPA } from "./MesaPA";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AuthUser } from "@/hooks/useAuth";
import type { SiteSettings } from "@/types/siteSettings";
import { normalizarSetorUsuario } from "@/lib/userProfiles";

interface Props {
  processos: Processo[];
  filtroTipo: "todos" | "DU" | "PA";
  onEdit: (p: Processo) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, status: StatusProcesso) => void;
  onReativarProcesso?: (processoId: string, payload?: { motivo: string; novoPrazoFatal: string }) => void | Promise<void>;
  onRedistribuir?: (
    processoId: string,
    novoResponsavel: string,
    opcoes?: { situacaoFluxo?: string; mensagemHistorico?: string },
  ) => void | Promise<void>;
  usuario?: AuthUser;
  ehAdmin?: boolean;
  unreadProcessIds?: Set<string>;
  onReadProcess?: (processoId: string) => void;
  siteSettings?: SiteSettings;
  filtro?: FiltroPrazo;
  busca?: string;
}

export function MesaTrabalho({ processos, filtroTipo, onEdit, onDelete, onMove, onReativarProcesso, onRedistribuir, usuario, ehAdmin, unreadProcessIds, onReadProcess, siteSettings, filtro, busca }: Props) {
  const [assessoresDoSetor, setAssessoresDoSetor] = useState<{ nome: string; setor: string; corCard?: string }[]>([]);

  
  // Busca todos os assessores do setor (DU ou PA)
  useEffect(() => {
    const buscarAssessores = async () => {
      if (!usuario) return;

      const setorUsuarioNormalizado = normalizarSetorUsuario(usuario.setor || usuario.role || usuario.secao || usuario.cargo);
      const setoresParaBuscar: string[] = ehAdmin ? ["DU", "PA"] : [setorUsuarioNormalizado].filter(Boolean);
      if (setoresParaBuscar.length === 0) return;

      try {
        const usuariosRef = collection(db, "usuarios");
        const todosDocs: { nome: string; setor: string; corCard?: string }[] = [];

        for (const setorParaBuscar of setoresParaBuscar) {
          const q = query(usuariosRef, where("setor", "==", setorParaBuscar));
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(doc => {
            const data = doc.data() as { ativo?: boolean; nomeGuerra?: string; nome?: string; email?: string; posto?: string; setor?: string; corCard?: string };
            if (data.ativo === false) return;
            const nomeExibicao = data.nomeGuerra || data.nome || data.email?.split("@")[0] || "Assessor";
            const nomeCompleto = data.posto ? `${data.posto} ${nomeExibicao}`.trim() : nomeExibicao;
            todosDocs.push({ nome: nomeCompleto, setor: data.setor || setorParaBuscar, corCard: data.corCard });
          });
        }

        setAssessoresDoSetor(todosDocs);
      } catch (error) {
        console.error("❌ Erro ao buscar assessores:", error);
      }
    };
    
    buscarAssessores();
  }, [usuario, ehAdmin]);

  // Divide processos por setor
  const processosDU = processos.filter((p) => p.setor === "DU" || p.tipo === "DU");
  const processosPA = processos.filter((p) => p.setor === "PA" || p.tipo === "PA");

  // Divide assessores por setor
  const assessoresDU = assessoresDoSetor.filter((a) => a.setor === "DU");
  const assessoresPA = assessoresDoSetor.filter((a) => a.setor === "PA");

  // Determina se devem renderizar DU e PA baseado em filtroTipo e busca
  const buscaAtiva = !!busca?.trim();
  const renderDU = buscaAtiva || filtroTipo === "todos" || filtroTipo === "DU";
  const renderPA = buscaAtiva || filtroTipo === "todos" || filtroTipo === "PA";

  if (!renderDU && !renderPA) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm font-semibold text-muted-foreground">
          Nenhum processo ativo nesta visão.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {renderDU && (
        <MesaDU
          processos={processosDU}
          assessores={assessoresDU}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          onReativarProcesso={onReativarProcesso}
          onRedistribuir={onRedistribuir}
          ehAdmin={ehAdmin}
          unreadProcessIds={unreadProcessIds}
          onReadProcess={onReadProcess}
          siteSettings={siteSettings}
          filtro={filtro}
          busca={busca}
        />
      )}
      {renderPA && (
        <MesaPA
          processos={processosPA}
          assessores={assessoresPA}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          onReativarProcesso={onReativarProcesso}
          onRedistribuir={onRedistribuir}
          ehAdmin={ehAdmin}
          unreadProcessIds={unreadProcessIds}
          onReadProcess={onReadProcess}
          siteSettings={siteSettings}
          filtro={filtro}
          busca={busca}
        />
      )}
    </div>
  );
}
