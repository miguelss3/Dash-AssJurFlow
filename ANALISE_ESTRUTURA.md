# 📊 Análise da Estrutura do Projeto - Dash-AssJurFlow

## 🗑️ Arquivos e Pastas que Podem Ser REMOVIDOS

### ⚠️ ALTA PRIORIDADE - Remover Imediatamente

#### 1. **Pasta `/archive`** - **100% SEGURO REMOVER**
- **Localização**: `archive/`
- **Conteúdo**: Scripts e guias desatualizados
  - `archive/scripts/audit-firestore.mjs` - Versão antiga (v1 foi substituída por v2)
  - `archive/scripts/cleanup-duplicates.mjs` - Não está mais em uso
  - `archive/scripts/create-admin-profile.mjs` - Desatualizado
  - `archive/scripts/quarantine-orphan-messages.mjs` - Desatualizado
  - `archive/scripts/verificar-perfil-usuario.mjs` - Desatualizado
  - `archive/docs/` - Guias antigos de validação

**Ação**: Pode deletar toda a pasta `/archive`
```bash
rm -r archive/
```

#### 2. **Documentos de Configuração Desatualizados**
- `ADMIN_GUIDE.md` - Informações hardcoded sobre admin
- `FIREBASE_SETUP.md` - Instruções específicas para setup inicial

**Recomendação**: Consolidar em um único `SETUP.md` e mover exemplos para `.github/docs/`

#### 3. **Pasta `/public`** - **VERIFICAR ANTES**
- Se vazia ou com apenas assets padrão do Vite, pode remover
- Se contém ícones/logos utilizados, manter

**Verificar**:
```bash
ls -la public/
```

---

## 🏗️ DIVISÕES E REORGANIZAÇÕES RECOMENDADAS

### 1. **REFATORAÇÃO: Reorganizar `/src/lib`**

**Problema Atual**: Arquivo `prazo.ts` muito grande e monolítico
- 344 linhas com múltiplas responsabilidades
- Mistura cálculos, formatação e lógica de negócio

**Proposta**: Dividir em módulos menores

```
src/lib/
├── prazo/
│   ├── calcular.ts       # Cálculos de prazo e prorrogação
│   ├── formatear.ts      # Formatação de datas e textos
│   ├── tipos.ts          # Types e constantes (StatusPrazo, REGRAS_PRAZO)
│   ├── helpers.ts        # Funções auxiliares (toDateLocal, ehConselhoPA)
│   └── index.ts          # Exportações centralizadas
├── badge/
│   ├── du.ts             # Lógica de badges para DU
│   ├── pa.ts             # Lógica de badges para PA
│   └── index.ts
├── styles/
│   ├── classes.ts        # Utilities de CSS (cn, classesPrazo)
│   └── assessorStyles.ts # Já existe!
├── firebase.ts           # (manter como está)
├── utils.ts              # (simplificar, remover duplicatas)
└── userProfiles.ts       # (manter como está)
```

**Benefício**: Melhor manutenção, easier testing, menor complexidade por arquivo

---

### 2. **NOVO: Criar `/src/hooks/process`**

**Problema**: Hooks espalhados, falta separação entre dados e efeitos colaterais

**Proposta**: Reorganizar hooks por domínio

```
src/hooks/
├── process/
│   ├── useProcessos.ts      # (mover de src/hooks/)
│   ├── useProcessosStats.ts # (mover de src/hooks/)
│   └── index.ts             # Re-exportações
├── auth/
│   ├── useAuth.ts           # (mover de src/hooks/)
│   └── index.ts
├── settings/
│   ├── useSiteSettings.ts   # (mover de src/hooks/)
│   └── index.ts
├── calendar/
│   ├── useEventosCalendario.ts # (mover de src/hooks/)
│   └── index.ts
└── index.ts # Arquivo principal que re-exporta tudo
```

**Estrutura atualizada de imports**:
```typescript
// Antes:
import { useProcessos } from "@/hooks/useProcessos";
import { useAuth } from "@/hooks/useAuth";

// Depois (compatível):
import { useProcessos } from "@/hooks/process";
import { useAuth } from "@/hooks/auth";
```

---

### 3. **NOVO: Criar `/src/services` para Lógica de Negócio**

**Problema**: Componentes misturando UI com lógica Firestore

**Proposta**: Extrair serviços reutilizáveis

```
src/services/
├── processo/
│   ├── criar.ts          # createProcesso()
│   ├── atualizar.ts      # updateProcesso()
│   ├── listar.ts         # fetchProcessos()
│   ├── deletar.ts        # deleteProcesso()
│   └── index.ts
├── usuario/
│   ├── perfil.ts         # getPerfilUsuario()
│   ├── permissoes.ts     # checkPermissoes()
│   └── index.ts
├── chat/
│   ├── mensagens.ts      # getMensagens(), addMensagem()
│   └── index.ts
├── relatorios/
│   ├── exportar.ts       # exportPDF()
│   ├── gerar.ts          # generateReport()
│   └── index.ts
└── index.ts
```

**Exemplo de uso**:
```typescript
// Dentro de um componente
import { createProcesso } from "@/services/processo";

async function handleSalvar(dados) {
  await createProcesso(dados);
  toast.success("Processo criado!");
}
```

---

### 4. **REORGANIZAR: `/src/components` por Funcionalidade**

**Problema Atual**: Componentes misturados sem hierarquia clara

**Proposta**: Agrupar por feature/contexto

```
src/components/
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── MainLayout.tsx
├── processo/
│   ├── CardDU.tsx         # (mover de src/components/)
│   ├── CardPA.tsx         # (mover de src/components/)
│   ├── KanbanBoard.tsx    # (mover de src/components/)
│   ├── MesaTrabalho.tsx   # (mover de src/components/)
│   ├── MesaDU.tsx
│   ├── MesaPA.tsx
│   └── DetalhesModal.tsx  # (combinar DU + PA)
├── modals/
│   ├── CadastroModal.tsx  # (consolidar CadastroDU + CadastroPA)
│   ├── AcoesModal.tsx     # (consolidar AcoesDU, AcoesDPA, etc)
│   └── ChatModal.tsx
├── dashboard/
│   ├── Dashboard.tsx
│   ├── Estatisticas.tsx
│   ├── CalendarioPrazos.tsx
│   └── widgets/
├── settings/
│   ├── AjustesSite.tsx
│   ├── AjustesGerais.tsx
│   ├── GestaoEquipe.tsx
│   └── ajustes/
│       ├── AjustesDU.tsx
│       ├── AjustesPA.tsx
│       └── SortableItem.tsx
├── grupos/
│   ├── AssessorGroup.tsx
│   ├── ChefeGroup.tsx
│   └── SoldierAvatar.tsx
├── ui/                    # (manter como está - componentes base)
└── shared/
    ├── EmptyState.tsx     # (criar se não existir)
    ├── LoadingSpinner.tsx # (criar se não existir)
    └── ErrorBoundary.tsx  # (criar se não existir)
```

**Benefício**: Estrutura clara, fácil de navegar, melhor para colaboração em equipe

---

### 5. **NOVO: Criar `/src/types` Centralizado**

**Problema Atual**: Types espalhados, inconsistências

**Proposta**:
```
src/types/
├── processo.ts          # (já existe)
├── siteSettings.ts      # (já existe)
├── usuario.ts           # (criar - extrair tipos de useAuth)
├── chat.ts              # (criar - tipos de mensagens)
├── formularios.ts       # (criar - tipos de DTOs)
├── api.ts               # (criar - tipos de respostas)
└── index.ts             # Re-exportações
```

---

### 6. **NOVO: Criar `/src/constants`**

**Problema**: Valores mágicos espalhados pelo código

**Proposta**:
```
src/constants/
├── regras.ts            # REGRAS_PRAZO_PA, REGRAS_PRAZO_DU, etc
├── templates.ts         # Templates de mensagens
├── validacoes.ts        # Regex patterns, limites
├── permissoes.ts        # Permissões por role
└── index.ts
```

---

### 7. **NOVO: Criar `/src/utils`**

**Problema**: `src/lib/utils.ts` faz muita coisa (CSS + badges)

**Proposta**:
```
src/utils/
├── css.ts               # cn() para Tailwind
├── dates.ts             # Formatação de datas
├── strings.ts           # Manipulação de strings
├── validacoes.ts        # Validators
├── formatters.ts        # Formatadores gerais
└── index.ts
```

---

## 📋 CONSOLIDAÇÕES RECOMENDADAS

### 1. **Combinar Documentação**
```
Remover:
- ADMIN_GUIDE.md
- FIREBASE_SETUP.md

Criar:
- docs/SETUP.md
- docs/CONTRIBUTING.md
- docs/ARCHITECTURE.md
```

### 2. **Consolidar Modals Similares**
```
Arquivos para consolidar em um único componente:
- AcoesIPModalV4.tsx
- AcoesDUModalNovo.tsx
- AcoesPAModalV4.tsx
- AcoesConselhoModalV4.tsx

Proposta: Criar ActionsModal.tsx genérico com variantes
```

### 3. **Funções Firebase Duplicadas**
Buscar por:
```typescript
// Remover duplicatas de:
- setDoc
- updateDoc
- getDocs
```
Centralizar em `/src/services/`

---

## 📊 PLANO DE IMPLEMENTAÇÃO

### **Fase 1: Limpeza Inicial (30 min)**
- [ ] Deletar `/archive/`
- [ ] Consolidar ADMIN_GUIDE.md + FIREBASE_SETUP.md
- [ ] Verificar e limpar `/public/`

### **Fase 2: Refatoração Crítica (2-3 horas)**
- [ ] Dividir `src/lib/prazo.ts` em submódulos
- [ ] Criar `/src/services/` com funções Firestore
- [ ] Criar `/src/constants/`

### **Fase 3: Reorganização (3-4 horas)**
- [ ] Reorganizar `/src/components` por feature
- [ ] Reorganizar `/src/hooks` em subpastas
- [ ] Atualizar imports globais

### **Fase 4: Melhorias (2-3 horas)**
- [ ] Consolidar modals duplicados
- [ ] Criar componentes shared (EmptyState, Loading, etc)
- [ ] Escrever documentação de arquitetura

---

## ✅ CHECKLIST DE SEGURANÇA

Antes de remover arquivos:
- [ ] Fazer backup (ou usar git branch)
- [ ] Buscar referências no projeto
- [ ] Verificar se há imports de arquivos a remover
- [ ] Testar a build: `npm run build`
- [ ] Testar localmente: `npm run dev`

**Exemplo de busca de referências**:
```bash
# Linux/Mac:
grep -r "archive" src/

# Windows (PowerShell):
Select-String -Path "src\**\*.tsx" -Pattern "archive"
```

---

## 💡 BENEFÍCIOS DA REORGANIZAÇÃO

✅ **Manutenção Facilitada**
- Código mais modular e organizado
- Fácil encontrar funcionalidades
- Redução de duplicação

✅ **Performance**
- Tree-shaking melhor do webpack
- Lazy loading mais eficiente
- Builds mais rápidos

✅ **Colaboração**
- Menos conflitos de merge
- Responsabilidades claras
- Onboarding mais fácil

✅ **Testabilidade**
- Funções isoladas
- Mocks mais simples
- Testes mais rápidos

---

## 🔗 Próximos Passos

1. **Priorizar**: Comece pela Fase 1 (limpeza)
2. **Incrementalmente**: Aplique Fase 2 e 3 aos poucos
3. **Documentar**: Mantenha este guia atualizado
4. **Revisar**: Faça code review das mudanças

Quer que eu comece a implementar alguma dessas divisões?
