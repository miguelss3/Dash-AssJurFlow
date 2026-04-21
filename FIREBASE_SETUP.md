# 🔥 Configuração do Firebase - AssJur Flow

## ✅ Sistema Funcionando em Modo Demo

O sistema agora carrega **dados de demonstração** automaticamente quando o Firebase não está configurado.

**Você verá:**
- ⚠️ Aviso no console: "Firebase não configurado. Usando dados de demonstração."
- 3 processos de exemplo no dashboard
- Todas as funcionalidades visuais funcionando

---

## � Como fazer Login

O sistema agora usa **autenticação por e-mail e senha**.

**Para acessar:**
1. Vá para: http://localhost:8081/login
2. Digite seu e-mail e senha cadastrados no Firebase Authentication
3. Clique em "Entrar no Sistema"

**Exemplo de credenciais (depois de configurar Firebase Auth):**
- E-mail: `miguel@12rm.eb.mil.br`
- Senha: `12rm2024`

---

## 🔧 Para Conectar ao Firebase Real

### 1️⃣ Configurar Regras do Firestore (OBRIGATÓRIO)

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto: **assjur-flow-12rm**
3. Vá em **Firestore Database** → **Regras**
4. Escolha uma das opções:

**Opção A - Desenvolvimento (Rápido, mas inseguro):**
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

**Opção B - Produção (Recomendado):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Apenas usuários autenticados
      allow read, write: if request.auth != null;
    }
  }
}
```

5. Clique em **Publicar**

---

### 2️⃣ Ativar Firebase Authentication

1. No console do Firebase, vá em **Authentication**
2. Clique em **Começar**
3. Ative o método **E-mail/Senha**
4. Vá em **Users** → **Adicionar usuário**

**Crie estes usuários:**

| E-mail | Senha |
|--------|-------|
| miguel@12rm.eb.mil.br | 12rm2024 |
| becker@12rm.eb.mil.br | 12rm2024 |
| perninha@12rm.eb.mil.br | 12rm2024 |

---

### 3️⃣ Testar Conexão

1. Recarregue a página: http://localhost:8081/login
2. Digite o e-mail: `miguel@12rm.eb.mil.br`
3. Digite a senha: `12rm2024`
4. Clique em "Entrar no Sistema"
5. Verifique o console do navegador (F12):
   - ✅ "Login Firebase realizado com sucesso" = Firebase conectado
   - ⚠️ "Usando autenticação local" = Ainda em modo mock

---

## 📊 Status Atual

✅ **Funcionando com dados mock** - O sistema já está utilizável  
✅ **Login tradicional com e-mail e senha**  
🔄 **Aguardando configuração Firebase** - Para dados reais  

---

## 🆘 Ainda com erro?

1. **Limpe o cache do navegador**: Ctrl + Shift + Delete
2. **Limpe o localStorage**: No console (F12), digite:
   ```javascript
   localStorage.clear()
   location.reload()
   ```
3. **Verifique o console**: Procure por mensagens "✅" (sucesso) ou "❌" (erro)
4. **Confira as credenciais**: Certifique-se de que o usuário foi criado no Firebase Authentication

---

## 🔒 Mensagens de Erro Comuns

| Erro | Solução |
|------|---------|
| `auth/invalid-credential` | E-mail ou senha incorretos |
| `auth/user-not-found` | Usuário não existe no Firebase Auth |
| `auth/too-many-requests` | Muitas tentativas, aguarde alguns minutos |
| `Missing or insufficient permissions` | Configure as regras do Firestore (Passo 1) |

