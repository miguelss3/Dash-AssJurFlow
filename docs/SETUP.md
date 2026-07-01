# 📚 Guia de Configuração - AssJur Flow Dash

Documentação consolidada para **Setup do Projeto**, **Autenticação** e **Sistema Admin**.

---

## 🚀 Início Rápido

### Status Atual
✅ **Sistema funcionando em modo demo** - Dados de demonstração carregados  
✅ **Login por e-mail e senha**  
✅ **Sistema Admin configurado**  

### Próximos Passos
1. Configure as [Regras do Firestore](#configurar-regras-do-firestore)
2. Ative a [Autenticação do Firebase](#ativar-firebase-authentication)
3. Crie usuários e [teste a conexão](#testar-conexão)

---

## 🔐 Como Fazer Login

O sistema usa **autenticação por e-mail e senha**.

### Acessar
1. Vá para: `http://localhost:8081/login`
2. Digite seu **e-mail** cadastrado no Firebase Authentication
3. Digite sua **senha**
4. Clique em "Entrar no Sistema"

### Exemplo de Credenciais
```
E-mail: miguel@12rm.eb.mil.br
Senha: 12rm2024
```

### Console do Navegador (F12)

**Mensagens esperadas:**

✅ **Sucesso - Firebase conectado:**
```
✅ Login Firebase realizado com sucesso
✅ 50 processos carregados (ADMIN)
✅ Login concluído. Admin: true
```

⚠️ **Modo Demo - Firebase não configurado:**
```
Firebase não configurado. Usando dados de demonstração.
✅ 3 processos de exemplo carregados
```

---

## 🔥 Configuração do Firebase

### 1️⃣ Configurar Regras do Firestore (OBRIGATÓRIO)

#### Passo a Passo

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: **assjur-flow-12rm**
3. Vá em **Firestore Database** → **Regras**
4. Escolha uma das opções abaixo

#### Opção A: Desenvolvimento (Rápido, mas inseguro)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ Qualquer pessoa pode acessar
    }
  }
}
```

#### Opção B: Produção (Recomendado)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas usuários autenticados
    allow read, write: if request.auth != null;
  }
}
```

#### Publicar
Clique em **Publicar** após escolher uma opção.

---

### 2️⃣ Ativar Firebase Authentication

1. No Firebase Console, vá em **Authentication**
2. Clique em **Começar**
3. Selecione **E-mail/Senha**
4. Ative o provedor
5. Vá em **Users** → **Adicionar usuário**

#### Criar Usuários

Crie estes usuários (exemplo):

| E-mail | Senha | Perfil |
|--------|-------|--------|
| miguelss3@yahoo.com.br | 12rm2024 | Admin |
| miguel@12rm.eb.mil.br | 12rm2024 | Usuário |
| becker@12rm.eb.mil.br | 12rm2024 | Usuário |
| perninha@12rm.eb.mil.br | 12rm2024 | Usuário |

---

### 3️⃣ Testar Conexão

1. Recarregue a página: `http://localhost:8081/login`
2. Digite um e-mail configurado
3. Digite a senha
4. Clique em "Entrar no Sistema"
5. Abra o console do navegador (F12) e procure:
   - ✅ "Login Firebase realizado com sucesso" = Firebase conectado
   - ⚠️ "Usando autenticação local" = Ainda em modo mock

---

## 👑 Sistema Admin

### Como Funciona

#### Usuários Regulares
- Veem **apenas seus próprios processos**
- Não podem acessar processos de outros usuários
- Totalmente isolados e seguros

#### Administradores (Admin)
- Veem **TODOS os processos do sistema**
- Podem gerenciar processos de todos os usuários
- Acesso completo ao sistema

### Como se Tornar Admin

#### Método 1: Email de Admin Universal

Faça login com um dos emails cadastrados como admin universal.

**Para adicionar emails admin:**

1. Edite: `src/hooks/useAuth.ts`
2. Localize:
   ```typescript
   const EMAILS_ADMIN_UNIVERSAL = new Set([
     "miguelss3@yahoo.com.br",
   ]);
   ```
3. Adicione novos emails:
   ```typescript
   const EMAILS_ADMIN_UNIVERSAL = new Set([
     "miguelss3@yahoo.com.br",
     "seu-novo-admin@example.com"  // ← Adicione aqui
   ]);
   ```

#### Método 2: Configurar via Firestore

1. Acesse: https://console.firebase.google.com/
2. Vá em **Firestore Database** → **Coleção: usuarios**
3. Encontre ou crie o documento do usuário
4. Adicione um destes campos:
   - `isChefe: true` (booleano)
   - `setor: "CHEFE ASSEAPASSJUR"` (string)
   - `cargo: "Admin Universal"` (string)

**Exemplo de documento admin:**

```json
{
  "email": "usuario@12rm.eb.mil.br",
  "nome": "João Silva",
  "nomeGuerra": "João",
  "posto": "Maj",
  "uid": "K5YJgdA8zwZ4mOx2AUUW...",
  "setor": "CHEFE ASSEAPASSJUR",
  "isChefe": true,
  "cargo": "Admin Universal"
}
```

### Testando o Sistema Admin

#### 1. Login como Admin

1. Acesse: `http://localhost:8081/login`
2. Digite o email admin: `miguelss3@yahoo.com.br`
3. Digite a senha configurada no Firebase Authentication

#### 2. Verificar Status no Console

Abra o **Console do navegador** (F12) e procure:

✅ **Admin bem-sucedido:**
```
👑 ADMIN detectado! Carregando TODOS os processos do Firebase...
✅ 50 processos carregados (ADMIN - todos os processos)
✅ Login concluído. Admin: true
```

❌ **Usuário regular:**
```
🔍 Usuário regular. Carregando apenas processos de: usuario@example.com
✅ 3 processos carregados para usuario@example.com
✅ Login concluído. Admin: false
```

#### 3. Comparar com Usuário Regular

1. Faça **logout**
2. Login com usuário regular: ex: `becker@aa.com.br`
3. Observe que aparecem **apenas os processos desse usuário**
4. Faça **logout**
5. Login como admin: `miguelss3@yahoo.com.br`
6. Observe que aparecem **TODOS os processos**

---

## 📊 Estrutura de Dados

### Coleção: `usuarios`

Exemplo de documento de usuário:

```json
{
  "id": "user123",
  "uid": "K5YJgdA8zwZ4...",
  "email": "miguel@example.com",
  "nome": "Miguel Santos",
  "nomeGuerra": "Miguel",
  "posto": "Maj",
  "setor": "CHEFE ASSEAPASSJUR",
  "cargo": "Admin Universal",
  "isChefe": true,
  "telefone": "(61) 99999-9999"
}
```

### Coleção: `processos`

Cada processo tem vinculação com o usuário que o criou:

```json
{
  "id": "proc123",
  "numero": "1234567-89.2026.4.01.3600",
  "cliente": "Sgt Silva",
  "userId": "K5YJgdA8zwZ4...",
  "userEmail": "becker@aa.com.br",
  "tipo": "DU",
  "status": "Andamento"
}
```

---

## 🔐 Regras de Segurança do Firestore

As regras do Firebase garantem isolamento de dados:

✅ **Admin:**
- Pode ler TODOS os processos
- Pode atualizar qualquer processo
- Pode excluir qualquer processo
- Pode gerenciar todos os usuários

✅ **Usuário Regular:**
- Lê apenas seus processos
- Atualiza apenas seus processos
- Exclui apenas seus processos
- Não acessa processos de outros

**Para aplicar as regras:**
1. Firebase Console → **Firestore Database** → **Regras**
2. Cole o conteúdo do arquivo `firestore.rules`
3. Clique em **Publicar**

---

## 🆘 Troubleshooting

### Problemas Comuns

| Problema | Solução |
|----------|---------|
| "Admin: false" no console | Verifique se o email está em `EMAILS_ADMIN_UNIVERSAL` ou se o usuário tem `isChefe`/`cargo`/`setor` correto no Firestore |
| "Permission denied" ao carregar processos | Atualize as regras do Firestore com o arquivo `firestore.rules` |
| "Nenhum processo" sendo admin | Verifique se existem processos na coleção "processos" do Firebase |
| Não aparece indicador visual de admin | Ainda não implementado na UI |
| `auth/invalid-credential` | E-mail ou senha incorretos |
| `auth/user-not-found` | Usuário não existe no Firebase Authentication |
| `auth/too-many-requests` | Muitas tentativas, aguarde alguns minutos |
| `Missing or insufficient permissions` | Configure as regras do Firestore |

### Redefinir Dados Locais

Se tiver problemas de cache:

1. **Limpe o cache do navegador**: `Ctrl + Shift + Delete`
2. **Limpe o localStorage** no console (F12):
   ```javascript
   localStorage.clear()
   location.reload()
   ```
3. **Verifique o console** (F12) procurando por mensagens "✅" (sucesso) ou "❌" (erro)

---

## 📋 Boas Práticas

### Gerenciamento de Usuários

1. **Sempre crie usuários no Firebase Authentication primeiro**
2. **Depois adicione o documento na coleção `usuarios`**
3. **Sincronize o UID entre Authentication e Firestore**

### Segurança

1. **Não compartilhe credenciais de admin**
2. **Use senhas fortes** para contas administrativas
3. **Configure as regras do Firestore** adequadamente
4. **Revise acessos regularmente**

### Operações

1. **Sempre teste em modo demo** antes de habilitar Firebase
2. **Verifique os logs do console** do navegador
3. **Mantenha backups** do Firebase

---

## 🔄 Diferença do Sistema Antigo

**Sistema Antigo (AssJurFlow):**
- Todos veem todos os processos
- Controle de acesso apenas na interface
- Não tinha segurança real no banco

**Sistema Novo (Dash-AssJurFlow):**
- Isolamento real por usuário
- Admin vê todos (como antes)
- Usuários regulares veem apenas os seus
- Segurança garantida pelo Firebase
- **Melhor experiência para usuários regulares**

---

**Documentação consolidada em:** `docs/SETUP.md`  
**Última atualização:** 2026-06-15
