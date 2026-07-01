# 🔍 Análise de Duplicações e Problemas de Manutenção

## 🚨 Código Duplicado Identificado

### 1. **Componentes Modal Duplicados**
```
⚠️ CRÍTICO: 4 variações de modals de ações que fazem a mesma coisa

Arquivos:
- src/components/modals/AcoesPAModalV4.tsx       (v4)
- src/components/modals/AcoesConselhoModalV4.tsx (v4)
- src/components/modals/AcoesIPModalV4.tsx       (v4)
- src/components/modals/AcoesDUModalNovo.tsx     (novo)
```

**Problema**: Versões antigas (não v4) podem estar sendo importadas
**Solução**: Consolidar em um único `ActionsModal.tsx` com variantes

---

### 2. **Importações de Firestore Duplicadas**
```typescript
// Mesmos imports em múltiplos componentes:
import { doc, updateDoc, setDoc, collection, addDoc } from "firebase/firestore";

Encontrado em:
- CardDU.tsx (linha 32)
- CardPA.tsx (linha 32)
- ChatModal.tsx (linha 6)
- AjustesSite.tsx (linha 4)
- GestaoEquipe.tsx (linha 2)
- DetalhesModalDU.tsx (linha 26)
```

**Problema**: Lógica repetida de CRUD
**Solução**: Criar `/src/services/processo.ts` centralizado

---

### 3. **Hooks Duplicados**
```typescript
// useAuth.ts exporta múltiplas coisas:
export { useAuth, isAdmin, nomeMilitarUsuario, ... }

// Mas alguns componentes fazem:
import { nomeMilitarUsuario } from "@/lib/userProfiles";  // Importação alternativa
import { useAuth, isAdmin } from "@/hooks/useAuth";       // Importação principal
```

**Problema**: Mesmos dados vindo de 2 lugares
**Solução**: Consolidar em `/src/hooks/auth/`

---

## 🗂️ Arquivos "Orfãos" (Não Utilizados)

### Possivelmente Não Utilizados:
```
✓ src/components/SoldierAvatar.tsx
  ↳ Importado por: AssessorGroup.tsx, ChefeGroup.tsx
  ↳ STATUS: EM USO ✅

✓ src/components/Estatisticas.tsx
  ↳ Procurando referências...
  
✓ src/components/CalendarioPrazos.tsx
  ↳ Procurando referências...

❓ /public/ (se não houver assets)
  ↳ Usar para verificar: ls -la public/
```

---

## 📦 Componentes com Múltiplas Responsabilidades

### Componentes que Fazem Demais:

#### 1. **CardDU.tsx** (~200+ linhas)
Responsabilidades:
- Renderizar UI do card
- Lógica de drag & drop
- Lógica de edição inline
- Chamadas ao Firestore
- Gerenciamento de estado

**Refatoração sugerida**:
```
CardDU.tsx (apenas UI, ~50 linhas)
  ├── CardDUContainer.tsx (lógica + estado, ~100 linhas)
  └── useCardDULogic.ts (Firestore, ~50 linhas)
```

#### 2. **CardPA.tsx** (~200+ linhas)
Mesmos problemas + lazy loading de 3 modals

**Refatoração sugerida**:
```
CardPA.tsx (UI, ~50 linhas)
  ├── CardPAContainer.tsx (lógica)
  ├── CardPAActionsLazy.tsx (lazy load dos modals)
  └── useCardPALogic.ts
```

#### 3. **AjustesSite.tsx** (~300+ linhas)
Responsabilidades:
- Drag & drop do Dnd-kit
- Múltiplas abas/tabs
- Salvamento no Firestore
- Estado local complexo

**Refatoração**:
```
AjustesSite.tsx (container/orquestrador)
  ├── AjustesDUTab.tsx
  ├── AjustesPATab.tsx
  ├── AjustesGeraisTab.tsx
  ├── AjustesAgendaTab.tsx
  └── DragDropContext.tsx (lógica compartilhada)
```

---

## 🔗 Dependências Circulares

### Possíveis Referências Circulares:
```
Monitorar:
- src/hooks/useProcessos.ts ← importa componentes?
- src/services/* ← devem ser puros, sem UI

Verificar com:
npm install -D circular-dependency-plugin
npm run build
```

---

## 📊 Análise de Tamanho de Arquivos

Arquivos maiores que 150 linhas (candidatos a split):

```
arquivo                              linhas  responsabilidades
────────────────────────────────────────────────────────────
src/lib/prazo.ts                    ~344    5+ (refatorar!)
src/components/AjustesSite.tsx      ~300+   5+ (refatorar!)
src/components/CardPA.tsx           ~250+   4+ (refatorar!)
src/components/CardDU.tsx           ~200+   4+ (refatorar!)
src/components/Dashboard.tsx        ~200+   3+ (refatorar)
src/hooks/useProcessos.ts           ~150    2 (OK)
src/lib/indicadoresPdf.ts           ~330+   3+ (refatorar!)
```

---

## 🔧 Problemas Técnicos Específicos

### 1. **Lazy Loading Ineficiente**
```typescript
// Em CardPA.tsx:
const AcoesPAModalV4 = lazy(() =>
  import("./modals/AcoesPAModalV4").then((m) => ({ default: m.AcoesPAModalV4 }))
);

// MELHOR SERIA:
const AcoesPAModalV4 = lazy(() =>
  import("./modals/AcoesPAModalV4").then((m) => m.AcoesPAModalV4)
);
```

### 2. **TypeScript Imports**
```typescript
// Evitar isso:
import type { AuthUser } from "@/hooks/useAuth";

// Usar isso:
import type { AuthUser } from "@/types/usuario";
```

### 3. **Pastas de UI**
```typescript
// Components de UI estão OK em src/components/ui/
// Mas deveria ter index.ts para re-exportações:

// Criar: src/components/ui/index.ts
export { Button } from "./button";
export { Dialog, DialogContent, ... } from "./dialog";
// etc

// Depois usar:
import { Button, Dialog, Card } from "@/components/ui";
```

---

## 🎯 Implementação Priorizada

### **SEMANA 1: Limpeza**
```
1. Remover /archive/ ✂️
2. Verificar /public/ 📁
3. Consolidar docs 📄
```

### **SEMANA 2: Serviços**
```
1. Criar /src/services/processo/
2. Mover lógica Firestore
3. Atualizar imports
```

### **SEMANA 3: Componentes**
```
1. Refatorar CardDU + CardPA
2. Dividir AjustesSite
3. Consolidar modals
```

### **SEMANA 4: Limpeza Final**
```
1. Reorganizar pastas
2. Atualizar tipos
3. Escrever testes
```

---

## ✅ Scripts Úteis

### Encontrar duplicatas:
```bash
# Procurar imports de Firestore:
grep -r "from \"firebase/firestore\"" src/

# Procurar funções duplicadas:
grep -r "function export" src/

# Verificar tamanho de arquivos:
find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | sort -rn
```

### Validar depois de refatorar:
```bash
npm run lint
npm run build
npm run dev
```

---

## 📝 Checklist Pós-Refatoração

- [ ] Nenhuma duplicação de código
- [ ] Todos os imports atualizados
- [ ] Build sem erros: `npm run build`
- [ ] Dev rodando sem erros: `npm run dev`
- [ ] Sem warnings de console
- [ ] Testes passando (se houver)
- [ ] Documentação atualizada

---

## 💬 Recomendação Final

**Comece pequeno**: 
1. Delete `/archive/` hoje
2. Crie `/src/services/processo/` amanhã
3. Refatore 1 componente por dia

**Não tente fazer tudo de uma vez** - risco de quebrar tudo!

Quer que eu implemente alguma dessas refatorações? Recomendo começar por:
1. Deletar `/archive/`
2. Criar `/src/services/processo.ts`
3. Extrair tipos para `/src/types/`
