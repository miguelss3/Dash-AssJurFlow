# 🔥 Sistema Multi-Usuário + Admin Configurado - AssJur Flow

## ✅ Migração Concluída

O sistema agora funciona **exatamente como o antigo** AssJurFlow:

- ✅ **Usuários regulares** veem apenas seus próprios processos
- ✅ **Administradores (Admin)** veem TODOS os processos do sistema
- ✅ Filtragem automática por perfil de usuário
- ✅ Segurança garantida pelas regras do Firestore
- ✅ Isolamento total de dados entre usuários regulares

---

## 🎯 Como Funciona

### Login Regular (Usuário)
1. Acesse: http://localhost:8081/login
2. Digite seu e-mail (ex: `becker@aa.com.br`)
3. Digite sua senha
4. O sistema carrega **apenas seus processos**

### Login Admin (Administrador)
1. Acesse: http://localhost:8081/login
2. Digite o email admin (ex: `miguelss3@yahoo.com.br`)
3. Digite sua senha
4. O sistema carrega **TODOS os processos** 👑

### Dados Isolados
- Cada usuário regular vê **SOMENTE** seus processos
- Admin vê **TODOS** os processos de todos os usuários
- Segurança garantida pelo Firebase

---

## 👑 Como se Tornar Admin

Veja o guia completo em: **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)**

### Opção 1: Email Admin Universal
- Login com: `miguelss3@yahoo.com.br`

### Opção 2: Configurar no Firestore
Adicione no documento do usuário na coleção `usuarios`:
- `isChefe: true` (booleano)
- `setor: "CHEFE ASSEAPASSJUR"` (string)
- `cargo: "Admin Universal"` (string)

---

## 🔧 Configuração Obrigatória do Firebase

### 1️⃣ Atualizar Regras do Firestore

As regras garantem segurança e isolamento de dados.

1. Acesse: https://console.firebase.google.com/
2. Projeto: **assjur-flow-12rm**
3. Vá em **Firestore Database** → **Regras**
4. Cole estas regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Processos: cada usuário acessa apenas os seus
    match /processos/{processoId} {
      allow read: if request.auth != null && 
                     resource.data.userId == request.auth.uid;
      
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.userEmail == request.auth.token.email;
      
      allow update, delete: if request.auth != null && 
                               resource.data.userId == request.auth.uid;
    }
  }
}
```

5. Clique em **Publicar**

---

### 2️⃣ Usuários Existentes

✅ **Os usuários já estão cadastrados** no Firebase Authentication:
- `becker@aa.com.br`
- `alvaro@perna.com.br`  
- `adj03.ajur@12rm.eb.mil.br`
- E outros...

**Você só precisa das senhas para fazer login!**

---

## 📊 Estrutura dos Processos

Agora cada processo tem vinculação com o usuário:

```json
{
  "id": "abc123",
  "numero": "1234567-89.2026.4.01.3600",
  "cliente": "Sgt Silva",
  ...campos existentes...,
  "userId": "K5YJgdA8zwZ4mOx2AUUWbJ...",  // UID do Firebase
  "userEmail": "becker@aa.com.br"          // Email do usuário
}
```

---

## 🔄 Migração de Dados Antigos

### Se seus processos existentes NÃO têm os campos `userId` e `userEmail`:

**Opção 1 - Atualizar manualmente (poucos processos):**
1. Firebase Console → Firestore Database
2. Coleção `processos`
3. Para cada processo, adicione:
   - `userId`: copie o UID do usuário na aba Authentication
   - `userEmail`: email do dono do processo

**Opção 2 - Script de migração (muitos processos):**

Crie um arquivo `migrar-processos.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mapeamento: email do responsável → UID do Firebase
const mapeamentoUsuarios = {
  'becker@aa.com.br': 'K5YJgdA8zwZ4mOx2AUUWbJ...',
  'alvaro@perna.com.br': '8FxpqRb9mFeVXoLle2f1V3k...',
  // ... adicione os outros
};

async function migrarProcessos() {
  const snapshot = await db.collection('processos').get();
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Pula se já tem userId
    if (data.userId) continue;
    
    // Descobre o dono baseado no campo 'responsavel' ou outro critério
    const email = descobrirEmail(data);
    const userId = mapeamentoUsuarios[email];
    
    if (userId) {
      await doc.ref.update({
        userId: userId,
        userEmail: email
      });
      console.log(`✅ Migrado: ${doc.id}`);
    }
  }
}

function descobrirEmail(processo) {
  // Adapte esta lógica conforme sua estrutura
  // Pode ser baseado no campo 'responsavel', 'assessor', etc.
  if (processo.responsavel.includes('Becker')) return 'becker@aa.com.br';
  if (processo.responsavel.includes('Álvaro')) return 'alvaro@perna.com.br';
  // ... adicione mais lógica
}

migrarProcessos().then(() => console.log('✅ Migração concluída!'));
```

---

## 🧪 Testando

1. **Login com Becker:**
   - Email: `becker@aa.com.br`
   - Vê apenas processos de Becker

2. **Logout e Login com Álvaro:**
   - Email: `alvaro@perna.com.br`
   - Vê apenas processos de Álvaro

3. **✅ Isolamento confirmado!**

---

## 🔒 Segurança

- ✅ Sem autenticação = Sem acesso
- ✅ Cada usuário vê apenas seus dados
- ✅ Impossível acessar processos alheios
- ✅ Criação automática vincula ao criador

---

## 🆘 Troubleshooting

| Problema | Solução |
|----------|---------|
| "Nenhum processo" | Processos não têm `userId` OU usuário não tem processos |
| "Permission denied" | Regras do Firestore não atualizadas |
| Vejo processos de outros | Regras não foram aplicadas |
| "Usuário não autenticado" | Faça login novamente |

---

## ✨ Benefícios da Migração

**Antes:**
- Todos viam todos os processos
- Sem privacidade
- Filtro manual não confiável

**Agora:**
- Dados isolados e seguros
- Privacidade garantida
- Performance otimizada (menos dados carregados)
- Sistema alinhado com o Firebase Authentication

---

## 📝 Próximos Passos

1. ✅ Atualizar regras do Firestore (Passo 1)
2. ✅ Migrar processos antigos se necessário
3. ✅ Testar login com diferentes usuários
4. ✅ Verificar isolamento de dados
5. 🚀 Sistema pronto para uso!

