# ⚡ Guia Rápido: Primeiros Passos (HOJE!)

## 🚀 O que fazer agora (30 minutos)

### PASSO 1: Backup (5 min)
```bash
# Se estiver usando git:
git branch backup-antes-limpeza
git checkout backup-antes-limpeza
git commit -am "Backup antes da refatoração"
git checkout main
```

### PASSO 2: Remover /archive/ (2 min)
```bash
# Confirme que não há referências:
grep -r "archive" src/
# (não deve retornar nada)

# Delete a pasta:
rm -r archive/
```

### PASSO 3: Consolidar Documentação (15 min)

**Criar novo arquivo** `docs/SETUP.md`:
```markdown
# 🚀 Guia de Setup

## 1. Instalação de Dependências
npm install

## 2. Configurar Firebase (Opcional)
[Copiar partes relevantes de FIREBASE_SETUP.md]

## 3. Como virar Admin
[Copiar parte de ADMIN_GUIDE.md]

## 4. Rodar Localmente
npm run dev
```

**Depois deletar**:
```bash
rm ADMIN_GUIDE.md
rm FIREBASE_SETUP.md
```

### PASSO 4: Testar Tudo (8 min)
```bash
npm run build
npm run dev
# Visitar http://localhost:5173
# Confirmar que tudo funciona
```

**Se algo quebrou**:
```bash
git checkout main  # voltar
```

---

## 📅 SEMANA 1: Refatoração em 4 Dias

### DIA 1: Serviços Firestore (1 hora)

**Criar** `src/services/processo/criar.ts`:
```typescript
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Processo } from "@/types/processo";

export async function criarProcesso(dados: Partial<Processo>, usuarioId: string) {
  try {
    const ref = collection(db, "processos");
    const doc = await addDoc(ref, {
      ...dados,
      usuarioId,
      criadoEm: Timestamp.now(),
      atualizadoEm: Timestamp.now(),
    });
    return doc.id;
  } catch (error) {
    console.error("Erro ao criar processo:", error);
    throw error;
  }
}
```

**Criar** `src/services/processo/atualizar.ts`:
```typescript
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function atualizarProcesso(
  processoId: string,
  dados: Record<string, any>
) {
  try {
    const ref = doc(db, "processos", processoId);
    await updateDoc(ref, {
      ...dados,
      atualizadoEm: Timestamp.now(),
    });
  } catch (error) {
    console.error("Erro ao atualizar processo:", error);
    throw error;
  }
}
```

**Criar** `src/services/processo/index.ts`:
```typescript
export { criarProcesso } from "./criar";
export { atualizarProcesso } from "./atualizar";
// ... outras exports
```

**Agora use em CardDU.tsx**:
```typescript
// ANTES:
import { addDoc, collection, Timestamp } from "firebase/firestore";
// ... 10 linhas de lógica de add

// DEPOIS:
import { criarProcesso } from "@/services/processo";

async function handleCriar() {
  await criarProcesso(novosDados, usuarioId);
}
```

### DIA 2: Dividir prazo.ts (1-2 horas)

**Criar** `src/lib/prazo/tipos.ts`:
```typescript
export type StatusPrazo = "overdue" | "today" | "soon" | "safe";

export const REGRAS_PRAZO_PA = {
  sindicancia: { dias: 60, prorrogacoes: 2 },
  ipm: { dias: 90, prorrogacoes: 3 },
  // ...
};

export const REGRAS_PRAZO_DU = {
  // ...
};
```

**Criar** `src/lib/prazo/calcular.ts`:
```typescript
import { differenceInCalendarDays } from "date-fns";
import { toDateLocal } from "./helpers";
import type { Processo } from "@/types/processo";

export function diasRestantes(prazo: unknown): number {
  const date = toDateLocal(prazo);
  if (!date) return 0;
  return differenceInCalendarDays(date, new Date());
}

export function statusPrazo(prazo: unknown): StatusPrazo {
  const dias = diasRestantes(prazo);
  if (dias < 0) return "overdue";
  if (dias === 0) return "today";
  if (dias <= 5) return "soon";
  return "safe";
}
```

**Criar** `src/lib/prazo/formatear.ts`:
```typescript
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toDateLocal } from "./helpers";

export function formatarData(prazo: unknown): string {
  const date = toDateLocal(prazo);
  if (!date) return "";
  return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatarDataCurta(prazo: unknown): string {
  const date = toDateLocal(prazo);
  if (!date) return "";
  return format(date, "dd/MM/yyyy");
}
```

**Criar** `src/lib/prazo/index.ts`:
```typescript
export * from "./tipos";
export * from "./calcular";
export * from "./formatear";
export { toDateLocal } from "./helpers";
// ... restante das exports
```

**Depois, deletar** `src/lib/prazo.ts` original e usar novo:
```typescript
// ANTES:
import { statusPrazo, diasRestantes } from "@/lib/prazo";

// DEPOIS (compatível!):
import { statusPrazo, diasRestantes } from "@/lib/prazo";
```

### DIA 3: Reorganizar Hooks (1-2 horas)

**Criar estrutura**:
```bash
mkdir -p src/hooks/auth
mkdir -p src/hooks/process
mkdir -p src/hooks/settings
mkdir -p src/hooks/calendar
```

**Criar** `src/hooks/auth/index.ts`:
```typescript
export { useAuth } from "./useAuth";
export { isAdmin } from "./isAdmin";
export type { AuthUser } from "./types";
```

**Mover e atualizar imports**:
```bash
# Copiar arquivo
cp src/hooks/useAuth.ts src/hooks/auth/useAuth.ts

# Atualizar imports dentro do arquivo se necessário
```

**Criar** `src/hooks/index.ts` (re-exportação central):
```typescript
export { useAuth } from "./auth";
export { useProcessos } from "./process";
export { useSiteSettings } from "./settings";
export { useEventosCalendario } from "./calendar";
```

### DIA 4: Deletar Modals Antigos (1 hora)

**Verificar qual é a versão "correta"**:
```bash
# Procurar qual é importada:
grep -r "AcoesDUModalNovo\|AcoesPAModalV4\|AcoesConselhoModalV4\|AcoesIPModalV4" src/
```

Se todas estão em uso, **consolidar em um único**:

**Criar** `src/components/modals/ActionsModal.tsx`:
```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Processo } from "@/types/processo";

interface ActionsModalProps {
  type: "du" | "pa" | "conselho" | "ip";
  processo: Processo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ActionsModal({ type, processo, open, onOpenChange }: ActionsModalProps) {
  switch (type) {
    case "du":
      return <DUActions processo={processo} open={open} onOpenChange={onOpenChange} />;
    case "pa":
      return <PAActions processo={processo} open={open} onOpenChange={onOpenChange} />;
    // ... restante
  }
}
```

Depois atualizar imports em CardDU.tsx e CardPA.tsx.

---

## 🎯 Antes e Depois: Exemplo Real

### ANTES (CardDU.tsx com lógica duplicada)
```typescript
// ~250 linhas
import { addDoc, collection, updateDoc, doc, Timestamp } from "firebase/firestore";

export function CardDU() {
  const handleSalvar = async (dados) => {
    try {
      const ref = collection(db, "processos");
      await addDoc(ref, {
        ...dados,
        usuarioId,
        criadoEm: Timestamp.now(),
      });
      toast.success("Salvo!");
    } catch (error) {
      toast.error("Erro");
    }
  };
  
  // ... 200+ linhas de UI
}
```

### DEPOIS (CardDU.tsx + service)
```typescript
// ~80 linhas em CardDU.tsx
import { criarProcesso } from "@/services/processo";

export function CardDU() {
  const handleSalvar = async (dados) => {
    try {
      await criarProcesso(dados, usuarioId);
      toast.success("Salvo!");
    } catch (error) {
      toast.error("Erro");
    }
  };
  
  // ... UI apenas
}
```

**Benefício**: 
- Reduz 200 linhas → 80 linhas
- Lógica reutilizável em outros componentes
- Testável separadamente
- Manutenção facilitada

---

## ✅ Checklist Diário

### DIA 1 ✓
```
[ ] Deletar /archive/
[ ] Consolidar docs em docs/SETUP.md
[ ] npm run build && npm run dev
```

### DIA 2 ✓
```
[ ] Criar /src/services/processo/
[ ] Atualizar CardDU.tsx
[ ] Atualizar CardPA.tsx
[ ] npm run build && npm run dev
```

### DIA 3 ✓
```
[ ] Dividir src/lib/prazo.ts
[ ] Reorganizar /src/hooks/
[ ] Atualizar imports
[ ] npm run build && npm run dev
```

### DIA 4 ✓
```
[ ] Consolidar ActionsModal
[ ] Atualizar CardDU e CardPA
[ ] npm run build && npm run dev
[ ] Commit final: "refactor: cleanup and restructure"
```

---

## 🚨 Se Algo Quebrar

```bash
# Voltar para backup:
git checkout backup-antes-limpeza

# Ou voltar último commit:
git revert HEAD

# Ou usar git stash:
git stash
```

---

## 📞 Precisa de Ajuda?

Peça para implementar:
1. **"Implement /src/services/processo/"** - Extrair lógica Firestore
2. **"Refactor src/lib/prazo.ts"** - Dividir em submódulos
3. **"Reorganize /src/hooks"** - Agrupar em pastas
4. **"Consolidate ActionsModal"** - Unificar 4 variações

Cada um leva ~30-60 minutos para implementação total!

---

**Recomendação**: Comece HOJE com os primeiros 30 minutos (Passos 1-4).
Depois continue 1 dia por semana com as refatorações maiores.

Quer que eu implemente algum desses passos agora?
