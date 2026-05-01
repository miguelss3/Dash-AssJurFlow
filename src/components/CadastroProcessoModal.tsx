import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Processo } from "@/types/processo";
import { useAuth, isAdmin } from "@/hooks/useAuth";
import { CadastroDU } from "@/components/modals/CadastroDU";
import { CadastroPA } from "@/components/modals/CadastroPA";
import type { SiteSettings } from "@/types/siteSettings";

interface CadastroProcessoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo?: Processo | null;
  onSuccess?: () => void;
  siteSettings?: SiteSettings;
}

const inferirSetorUsuario = (user: { setor?: string; role?: string; secao?: string; cargo?: string } | null | undefined): "DU" | "PA" | "" => {
  const candidatos = [user?.setor, user?.role, user?.secao, user?.cargo]
    .filter(Boolean)
    .map((v) => String(v).toUpperCase());

  if (candidatos.some((v) => v.includes("DU") || v.includes("DEFESA DE USU"))) {
    return "DU";
  }
  if (candidatos.some((v) => v.includes("PA") || v.includes("PROCESSOS ADMIN"))) {
    return "PA";
  }
  return "";
};

const inferirSetorProcesso = (processo?: Processo | null): "DU" | "PA" => {
  const setor = String(processo?.setor || processo?.tipo || "DU").toUpperCase();
  return setor === "PA" ? "PA" : "DU";
};

export function CadastroProcessoModal({ open, onOpenChange, processo, onSuccess, siteSettings }: CadastroProcessoModalProps) {
  const { user } = useAuth();
  const ehAdminOuChefe = isAdmin(user);

  const setorUsuario = useMemo(() => inferirSetorUsuario(user), [user]);
  const [setorEscolhido, setSetorEscolhido] = useState<"DU" | "PA" | "">("");

  useEffect(() => {
    if (!open) {
      setSetorEscolhido("");
    }
  }, [open]);

  if (processo) {
    const setorEdicao = inferirSetorProcesso(processo);
    if (setorEdicao === "PA") {
      return (
        <CadastroPA
          open={open}
          onOpenChange={onOpenChange}
          processo={processo}
          onSuccess={onSuccess}
          siteSettings={siteSettings}
        />
      );
    }

    return (
      <CadastroDU
        open={open}
        onOpenChange={onOpenChange}
        processo={processo}
        onSuccess={onSuccess}
        siteSettings={siteSettings}
      />
    );
  }

  if (!ehAdminOuChefe && setorUsuario === "PA") {
    return (
      <CadastroPA
        open={open}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        siteSettings={siteSettings}
      />
    );
  }

  if (!ehAdminOuChefe && setorUsuario === "DU") {
    return (
      <CadastroDU
        open={open}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
        siteSettings={siteSettings}
      />
    );
  }

  if (setorEscolhido === "PA") {
    return (
      <CadastroPA
        open={open}
        onOpenChange={(valor) => {
          if (!valor) setSetorEscolhido("");
          onOpenChange(valor);
        }}
        onSuccess={onSuccess}
        siteSettings={siteSettings}
      />
    );
  }

  if (setorEscolhido === "DU") {
    return (
      <CadastroDU
        open={open}
        onOpenChange={(valor) => {
          if (!valor) setSetorEscolhido("");
          onOpenChange(valor);
        }}
        onSuccess={onSuccess}
        siteSettings={siteSettings}
      />
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(valor) => {
        if (!valor) setSetorEscolhido("");
        onOpenChange(valor);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Processo</DialogTitle>
          <DialogDescription>
            Qual setor deseja cadastrar?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            size="lg"
            className="h-20 text-sm font-bold"
            onClick={() => setSetorEscolhido("DU")}
          >
            Defesa de Usuários (DU)
          </Button>

          <Button
            type="button"
            size="lg"
            variant="outline"
            className="h-20 text-sm font-bold"
            onClick={() => setSetorEscolhido("PA")}
          >
            Processos Admin (PA)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
