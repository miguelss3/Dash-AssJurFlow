# 📊 Comparação: Auditoria v1 vs v2

## 📈 Evolução da Auditoria Firestore

### Auditoria v1 (Original)
**Arquivo:** `scripts/audit-firestore.mjs`

**Escopo:**
- ✅ Verificação de status de processos (canonicidade)
- ✅ Validação de tipos (DU/PA/OUTRO)
- ✅ Detecção de inconsistências status/finalizado
- ✅ Procura por processos órfãos (sem mensagem)
- ✅ Detecção de responsáveis divergentes

**Não cobria:**
- ❌ Sincronização Firebase Auth ↔ Firestore
- ❌ Duplicação de e-mails
- ❌ Validação de UIDs
- ❌ Integridade de campos obrigatórios
- ❌ Usuários inativos com dados relacionados
- ❌ Relatórios em HTML

---

### Auditoria v2 (Expandida)
**Arquivo:** `scripts/audit-firestore-v2.mjs`

**Novo Escopo:**
- ✅ Tudo de v1, MAIS:
- ✅ Sincronização Auth ↔ Firestore (UIDs, e-mails)
- ✅ Detecção de e-mails duplicados
- ✅ Validação de e-mails (formato)
- ✅ Campos obrigatórios em todas as coleções
- ✅ Setores inválidos (agora mais restritivo)
- ✅ Roles inválidas
- ✅ Usuários inativos com processos
- ✅ Integridade de eventos
- ✅ Integridade de configurações
- ✅ Relatório HTML interativo
- ✅ Relatório JSON estruturado

---

## 🔄 Execução

### v1 (Original)
```bash
FIREBASE_AUDIT_PASSWORD="sua-senha" node scripts/audit-firestore.mjs
```
**Saída:** Console apenas, JSON estruturado no terminal

### v2 (Novo)
```bash
FIREBASE_AUDIT_PASSWORD="sua-senha" node scripts/audit-firestore-v2.mjs
```
**Saída:** 
- Console com progresso colorido
- `auditoria-firestore-v2.json` (estruturado)
- `auditoria-firestore-v2.html` (visualização)

---

## 🎯 Quando Usar Cada Uma

### Use v1 se:
- Quer auditar apenas **status e tipos de processos**
- Precisa de verificação **rápida**
- Está rodando em CI/CD com output simples

### Use v2 se:
- Quer **verificação completa** do banco
- Precisa de **sincronização Auth/Firestore**
- Quer **relatórios visuais** para stakeholders
- Está investigando **problemas de consistência**
- Quer **comparar com auditoria anterior**

---

## 📋 Checklist de Problemas Potenciais

### Sincronização (NOVO v2)
- [ ] UID faltando em usuário
- [ ] E-mail duplicado em múltiplos usuários
- [ ] E-mail sem símbolo @
- [ ] Setor inválido ou vazio
- [ ] Role inválida ou vazia
- [ ] Usuário inativo com processos associados

### Integridade (v2 EXPANDIDA)
- [ ] Processo sem campo obrigatório
- [ ] Processo sem mensagem associada
- [ ] Processo sem distribuição (PA)
- [ ] Distribuição órfã (sem processo)
- [ ] Mensagem órfã (sem processo)
- [ ] Evento órfão (sem processo)
- [ ] Responsável não encontrado no cadastro

### Status (v1 + v2)
- [ ] Status não canônico
- [ ] Status concluído sem marcar finalizado
- [ ] Status finalizado mas não concluído

---

## 📈 Histórico

| Versão | Data | Foco |
|--------|------|------|
| v1 | Anterior | Processos e Status |
| v2 | 28/abr/2026 | Sincronização Auth + Integridade Completa |

---

## 🔧 Rotina Recomendada

### Diária
```bash
# Rodar v2 antes de mudanças críticas
FIREBASE_AUDIT_PASSWORD="..." npm run audit:firestore
# Revisar console para avisos imediatos
```

### Semanal
```bash
# Guardar relatório v2
cp auditoria-firestore-v2.json backups/auditoria-$(date +%Y%m%d).json
# Comparar com semana anterior
diff backups/auditoria-*.json | less
```

### Mensal
```bash
# Gerar comparativo v1 vs v2
# Revisar com o time de devops
# Implementar correções identificadas
```

---

## 🚀 Próximos Passos

Se v2 identificar problemas:

1. **Sincronização Auth**
   ```javascript
   // Corrigir UID
   db.collection('usuarios').doc(docId).update({ uid: uidCorreto })
   ```

2. **E-mails Duplicados**
   ```javascript
   // Desativar duplicatas (mantém o primeiro)
   db.collection('usuarios').doc(duplicata).update({ ativo: false })
   ```

3. **Campos Obrigatórios Faltando**
   ```javascript
   // Adicionar valor padrão ou corrigir
   db.collection('colecao').doc(docId).update({ campo: valorPadrao })
   ```

4. **Responsáveis Inválidos**
   ```javascript
   // Limpar ou atribuir a responsável válido
   db.collection('processos').doc(id).update({ 
     responsavel: usuarioValido.nome 
   })
   ```

---

## 📞 Suporte

- Dúvidas sobre v1? Verifique `scripts/audit-firestore.mjs`
- Dúvidas sobre v2? Verifique `AUDITORIA_FIRESTORE_V2_GUIA.md`
- Problemas encontrados? Consulte os detalhes em `auditoria-firestore-v2.html`
