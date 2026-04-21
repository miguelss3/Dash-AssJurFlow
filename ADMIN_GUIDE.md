# 👑 Guia do Administrador - AssJur Flow Dash

## ✅ Sistema Admin Configurado

O sistema agora funciona **exatamente como o AssJurFlow antigo** - administradores veem TODOS os processos, enquanto usuários regulares veem apenas os seus.

---

## 🎯 Como Funciona

### Usuários Regulares
- Veem **apenas seus próprios processos**
- Não podem acessar processos de outros usuários
- Totalmente isolados e seguros

### Administradores (Admin)
- Veem **TODOS os processos do sistema**
- Podem gerenciar processos de todos os usuários
- Acesso completo ao sistema

---

## 🔑 Como se Tornar Admin

### Método 1: Email de Admin Universal

Faça login com um dos emails cadastrados como admin universal:
- `miguelss3@yahoo.com.br`

**Para adicionar mais emails admin:**
1. Edite o arquivo: `src/hooks/useAuth.ts`
2. Adicione o email na linha:
   ```typescript
   const EMAILS_ADMIN_UNIVERSAL = new Set([
     "miguelss3@yahoo.com.br",
     "seu-novo-admin@example.com"  // ← Adicione aqui
   ]);
   ```

### Método 2: Configurar Usuário no Firestore

1. Acesse o Firebase Console: https://console.firebase.google.com/
2. Vá em **Firestore Database**
3. Acesse a coleção **usuarios**
4. Encontre ou crie o documento do usuário
5. Adicione um dos campos:
   - `isChefe: true` (booleano)
   - `setor: "CHEFE ASSEAPASSJUR"` (string)
   - `cargo: "Admin Universal"` (string)

**Exemplo de documento de admin:**
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

---

## 🧪 Testando o Sistema Admin

### 1. Login como Admin

1. Acesse: http://localhost:8081/login
2. Digite o email admin: `miguelss3@yahoo.com.br`
3. Digite a senha configurada no Firebase Authentication

### 2. Verificar Status Admin

Após o login, abra o **Console do navegador** (F12) e procure por:

✅ **Mensagens de admin bem-sucedido:**
```
👑 ADMIN detectado! Carregando TODOS os processos do Firebase...
✅ 50 processos carregados (ADMIN - todos os processos)
✅ Login concluído. Admin: true
```

❌ **Se não for admin:**
```
🔍 Usuário regular. Carregando apenas processos de: usuario@example.com
✅ 3 processos carregados para usuario@example.com
✅ Login concluído. Admin: false
```

### 3. Comparar com Usuário Regular

1. **Faça logout**
2. **Login com usuário regular**: ex: `becker@aa.com.br`
3. Veja que só aparecem os processos desse usuário
4. **Logout novamente**
5. **Login como admin**: `miguelss3@yahoo.com.br`
6. Veja que aparecem **TODOS os processos** do sistema

---

## 🔒 Regras de Segurança do Firestore

As regras do Firebase garantem que:

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

## 📊 Estrutura de Dados

### Coleção: `usuarios`

Exemplo de documento admin:
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
  ...outros campos...
}
```

---

## 🆘 Troubleshooting Admin

| Problema | Solução |
|----------|---------|
| "Admin: false" no console | Verifique se o email está em EMAILS_ADMIN_UNIVERSAL ou se o usuário tem isChefe/cargo/setor correto no Firestore |
| "Permission denied" ao carregar processos | Atualize as regras do Firestore com o arquivo firestore.rules |
| "Nenhum processo" sendo admin | Verifique se existem processos na coleção "processos" do Firebase |
| Não aparece indicador visual de admin | Ainda não implementado na UI (futuro) |

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

## 📝 Boas Práticas Admin

### Gerenciamento de Usuários

1. **Sempre crie usuários no Firebase Authentication primeiro**
2. **Depois adicione o documento na coleção `usuarios`**
3. **Sincronize o UID entre Authentication e Firestore**

### Segurança

1. **Não compartilhe credenciais de admin**
2. **Sempre faça logout em computadores compartilhados**
3. **Revise as regras do Firestore periodicamente**

### Manutenção

1. **Backup regular dos dados do Firestore**
2. **Monitore os logs de acesso no Firebase Console**
3. **Revise permissões de usuários mensalmente**

---

## ✨ Recursos Futuros

Recursos planejados para admins:

- 🎨 **Badge visual "ADMIN"** no dashboard
- 📊 **Dashboard administrativo** com estatísticas gerais
- 👥 **Gerenciamento de usuários** pela interface
- 📈 **Relatórios consolidados** de todos os processos
- 🔍 **Busca avançada** em todos os processos
- 📧 **Notificações de sistema** para admins

---

## 🚀 Suporte

Para problemas ou dúvidas sobre o sistema admin:

1. Verifique os logs do console do navegador (F12)
2. Consulte este guia
3. Revise o arquivo `firestore.rules`
4. Entre em contato com o desenvolvedor do sistema

---

## 📚 Documentos Relacionados

- [FIREBASE_SETUP.md](FIREBASE_SETUP.md) - Configuração inicial do Firebase
- [MIGRACAO_MULTI_USUARIO.md](MIGRACAO_MULTI_USUARIO.md) - Migração de dados
- [firestore.rules](firestore.rules) - Regras de segurança

