# 🧹 Script de Limpeza - Remover Duplicados

## Situação Atual

Você recriou 2 usuários quando o antigo falhou:

| Tipo | Email | Documento | Status |
|------|-------|-----------|--------|
| ❌ ANTIGO | melynda.adv@gmail.com | K5YJgdA8zwZ4mQx2AUUWbJPBKHk2 | Inativo, pode deletar |
| ✅ NOVO | melynda.adv@gmail.com | **bawYZ4KZebaK1KIAGjYPort4apE3** | **Funcionando** |
| ❌ ANTIGO | marlon.rodrigues@eb.mil.br | VglK2uSQyeUVoZvl8mskAdNDmTC2 | Pode deletar |
| ✅ NOVO | marlon.rodrigues@eb.mil.br | **1xJoGC3siaaN9S9EdugI5FMHw1o2** | **Funcionando** |

## 🚀 Como Executar o Script de Limpeza

```bash
# Passo 1: Confirmar a limpeza
CONFIRM_CLEANUP=SIM \
FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br" \
FIREBASE_AUDIT_PASSWORD="123456" \
node scripts/cleanup-duplicates.mjs
```

## ⚠️ O QUE SERÁ DELETADO

- ❌ `K5YJgdA8zwZ4mQx2AUUWbJPBKHk2` (Becker antigo)
- ❌ `VglK2uSQyeUVoZvl8mskAdNDmTC2` (Marlon antigo)

## ✅ O QUE SERÁ MANTIDO

- ✅ `bawYZ4KZebaK1KIAGjYPort4apE3` (Becker novo - FUNCIONANDO)
- ✅ `1xJoGC3siaaN9S9EdugI5FMHw1o2` (Marlon novo - FUNCIONANDO)

## 📝 Passo a Passo Seguro

### 1️⃣ Teste SEM deletar (Ver o que vai ser feito)
```bash
FIREBASE_AUDIT_PASSWORD="123456" node scripts/cleanup-duplicates.mjs
# Vai mostrar a lista, mas NÃO deleta (segurança)
```

### 2️⃣ Confirme a limpeza (Com CONFIRM_CLEANUP=SIM)
```bash
CONFIRM_CLEANUP=SIM \
FIREBASE_AUDIT_PASSWORD="123456" \
node scripts/cleanup-duplicates.mjs
```

### 3️⃣ Rode a auditoria novamente
```bash
FIREBASE_AUDIT_PASSWORD="123456" \
node scripts/audit-firestore-v2.mjs
# Deve mostrar 0 emails duplicados agora
```

## 🔍 Resultado Esperado

**Antes da Limpeza:**
```
E-MAILS DUPLICADOS: 2
- melynda.adv@gmail.com: K5YJgdA8zwZ4mQx2AUUWbJPBKHk2 + bawYZ4KZebaK1KIAGjYPort4apE3
- marlon.rodrigues@eb.mil.br: VglK2uSQyeUVoZvl8mskAdNDmTC2 + 1xJoGC3siaaN9S9EdugI5FMHw1o2
```

**Depois da Limpeza:**
```
E-MAILS DUPLICADOS: 0 ✅
MENSAGENS ÓRFÃS: 53 (isso é normal, não afeta usuários)
```

## 🛡️ Segurança

✅ Script é **somente para deletar documentos duplicados**
✅ Não toca em Firebase Auth (senhas/credenciais)
✅ Não toca em processos, distribuições, mensagens
✅ Requer confirmação explícita (CONFIRM_CLEANUP=SIM)

## 📞 Se algo der errado

Se o script falhar:
1. Nenhum documento foi deletado (falha antes de alterar)
2. Faça em manual no Firebase Console:
   - Firestore Database → usuarios
   - Delete: K5YJgdA8zwZ4mQx2AUUWbJPBKHk2
   - Delete: VglK2uSQyeUVoZvl8mskAdNDmTC2

## ✨ Próximos Passos Recomendados

1. ✅ Rodar cleanup
2. ✅ Rodar auditoria novamente
3. ✅ Fazer logout/login dos novos usuários para sincronizar cache
4. ✅ Verificar se funciona normalmente
