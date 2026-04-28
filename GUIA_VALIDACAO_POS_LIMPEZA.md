# 🧪 Guia de Validação Pós-Limpeza

## Antes de Começar
Certificar-se de que você fez logout de todas as sessões antigas de:
- melynda.adv@gmail.com (Becker antigo)
- marlon.rodrigues@eb.mil.br (Marlon antigo)

---

## ✅ Testes Recomendados

### 1️⃣ Login com Novo Usuário - Becker

```
Email: melynda.adv@gmail.com
Senha: (a senha que você criou para este novo usuário)
UID Esperado: bawYZ4KZebaK1KIAGjYPort4apE3
```

**Validar:**
- [ ] Login bem-sucedido
- [ ] Dashboard aparece
- [ ] Perfil mostra "Becker" 
- [ ] Setor mostra "CHEFE ASSEAPASSJUR"
- [ ] isChefe = true (verificar em DevTools: `localStorage.getItem('authUser')`)
- [ ] Admin view ✅ acessível (menu expandido)

---

### 2️⃣ Login com Novo Usuário - Marlon

```
Email: marlon.rodrigues@eb.mil.br
Senha: (a senha que você criou para este novo usuário)
UID Esperado: 1xJoGC3siaaN9S9EdugI5FMHw1o2
```

**Validar:**
- [ ] Login bem-sucedido
- [ ] Dashboard aparece
- [ ] Perfil mostra "Marlon"
- [ ] Setor mostra "Assessoria"
- [ ] isChefe = "Sim" (verificar localStorage)
- [ ] Admin view ✅ acessível

---

### 3️⃣ Testar Edição de Email (Próprio Usuário)

**Usando conta Becker:**

1. Acesse: Dashboard → AjustesSite
2. Tente editar seu próprio email para: `novo.becker@eb.mil.br`
3. Confirme a ação

**Validar:**
- [ ] Email atualizado em Firestore (UID: bawYZ4KZebaK1KIAGjYPort4apE3)
- [ ] Email atualizado em Firebase Auth
- [ ] Pode fazer login com novo email: `novo.becker@eb.mil.br`
- [ ] Não pode fazer login com email antigo

---

### 4️⃣ Testar Criação de Novo Usuário (Admin)

**Como Becker (chefe):**

1. Acesse: Dashboard → GestaoEquipe
2. Clique em "Novo Usuário"
3. Preencha formulário com dados de teste:
   ```
   Nome: João Teste
   Email: joao.teste@eb.mil.br
   Setor: Assessoria
   isChefe: Não
   ```
4. Clique "Criar Usuário"

**Validar:**
- [ ] Novo usuário criado com sucesso
- [ ] Sessão de admin NÃO foi interrompida (ainda logado como Becker)
- [ ] Novo usuário aparece na lista
- [ ] Novo usuário pode fazer login
- [ ] Novo usuário tem UID correto em Firestore

---

## 🔍 Verificações Técnicas (DevTools)

### Console → Application → LocalStorage → authUser

```json
{
  "uid": "bawYZ4KZebaK1KIAGjYPort4apE3",
  "email": "melynda.adv@gmail.com",
  "nome": "Becker",
  "isChefe": true,          // ← boolean true, não "Sim"
  "setor": "CHEFE ASSEAPASSJUR",
  "role": "admin"
}
```

### Verificar Duplicatas em Firestore

**Via Firebase Console:**
1. Firestore → Collection "usuarios"
2. Procurar por email: "melynda.adv@gmail.com"
3. Deve aparecer APENAS 1 documento: bawYZ4KZebaK1KIAGjYPort4apE3
4. Procurar por email: "marlon.rodrigues@eb.mil.br"  
5. Deve aparecer APENAS 1 documento: 1xJoGC3siaaN9S9EdugI5FMHw1o2

**NIÃ devem aparecer:**
- K5YJgdA8zwZ4mQx2AUUWbJPBKHk2 ❌ (deletado)
- VglK2uSQyeUVoZvl8mskAdNDmTC2 ❌ (deletado)

---

## 🚨 Se Algo Falhar

### Problema: "Email não sincroniza com Auth"
**Solução:**
1. Verifique permissões no Firestore (usuário precisa ter isChefe=true)
2. Só admin pode editar seu próprio email
3. Re-execute a auditoria:
   ```bash
   FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br" FIREBASE_AUDIT_PASSWORD="123456" node scripts/audit-firestore-v2.mjs
   ```

### Problema: "Sessão admin foi perdida ao criar usuário"
**Solução:**
- Verifique se GestaoEquipe.tsx está usando secondary app instance (linhas ~115-150)
- Re-execute a fix se necessário

### Problema: "Chefe não reconhecido como admin"
**Solução:**
1. Verifique campo isChefe em Firestore (deveria ser true/Sim/"Sim")
2. Verifique setor (deveria estar em perfilIndicaChefia em useAuth.ts)
3. Limpe localStorage: `localStorage.clear()`
4. Recarregue a página

---

## ✅ Checklist Final

- [ ] Becker (novo) consegue fazer login
- [ ] Marlon (novo) consegue fazer login  
- [ ] Ambos têm admin view acessível
- [ ] Email editing sincroniza com Auth
- [ ] Criação de novo usuário não perde sessão
- [ ] Nenhuma duplicata em Firestore
- [ ] Auditoria mostra 0 problemas críticos

---

## 📊 Dados de Comparação

### Antes da Limpeza
```
Total Usuários: 10
Emails Duplicados: 2 ⚠️
Problemas Auditoria: 56
```

### Depois da Limpeza
```
Total Usuários: 8
Emails Duplicados: 0 ✅
Problemas Auditoria: 54 ✅
```

---

Se todos os testes passarem, seu sistema está **pronto para produção** ✨
