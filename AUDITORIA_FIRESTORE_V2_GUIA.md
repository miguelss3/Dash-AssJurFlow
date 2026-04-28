# 🔍 Auditoria Firestore v2 - Guia de Execução

## Sobre este Script

Este é o segundo script de auditoria expandido que verifica:

✅ **Sincronização Auth ↔ Firestore**
- UIDs faltando ou inconsistentes
- E-mails duplicados
- E-mails inválidos
- Campos obrigatórios faltando

✅ **Integridade de Referências**
- Processos órfãos
- Distribuições órfãs
- Mensagens órfãs
- Responsáveis inválidos

✅ **Validação de Dados**
- Setores inválidos
- Roles inválidas
- Inconsistências de tipo/formato

✅ **Relatórios**
- JSON estruturado com todos os detalhes
- HTML interativo para visualização

---

## 🚀 Como Executar

### Pré-requisitos
```bash
# Instale as dependências Firebase se ainda não tiver
npm install firebase
```

### Execução Local

```bash
# Com credenciais padrão (miguelss3@yahoo.com.br)
FIREBASE_AUDIT_PASSWORD="sua-senha-aqui" node scripts/audit-firestore-v2.mjs
```

```bash
# Com credenciais customizadas
FIREBASE_AUDIT_EMAIL="seu-email@dominio.com.br" \
FIREBASE_AUDIT_PASSWORD="sua-senha-aqui" \
node scripts/audit-firestore-v2.mjs
```

### Execução via npm (se quiser adicionar script)

Adicione ao `package.json`:
```json
"scripts": {
  "audit:firestore": "node scripts/audit-firestore-v2.mjs"
}
```

Depois rode:
```bash
FIREBASE_AUDIT_PASSWORD="sua-senha" npm run audit:firestore
```

---

## 📊 Saída Gerada

O script gera dois arquivos:

1. **auditoria-firestore-v2.json**
   - Relatório estruturado em JSON
   - Contém todos os detalhes dos problemas encontrados
   - Útil para processamento automático

2. **auditoria-firestore-v2.html**
   - Visualização amigável no navegador
   - Tabelas interativas
   - Resumo executivo

---

## 📋 Categorias de Problemas Detectadas

| Categoria | Descrição |
|-----------|-----------|
| `sincronizacaoAuth` | Inconsistências entre Firebase Auth e Firestore |
| `uidsMissing` | Usuários sem UID definido |
| `emailsInvalidos` | E-mails sem formato válido |
| `emailsDuplicados` | E-mails repetidos em múltiplos documentos |
| `setoresInvalidos` | Valores de setor fora do padrão (DU/PA) |
| `rolesInvalidas` | Roles não reconhecidas (ASSESSOR/CHEFE) |
| `referenciasBroken` | Referências apontando para documentos inexistentes |
| `camposObrigatorios` | Campos essenciais faltando |
| `documentosOrfaos` | Documentos sem referência de entrada |
| `inconsistenciasSetor` | Setor principal ≠ setor em subdocumentos |
| `usuariosInativosComDados` | Usuários marcados como inativos mas com processos |
| `processosComResponsavelInvalido` | Responsável não encontrado no cadastro de usuários |
| `distribuicoesOrfas` | Distribuições apontando para processos inexistentes |
| `mensagensOrfas` | Mensagens sem processo associado |

---

## 🛠️ Correções Recomendadas

### Se encontrar duplicação de e-mail:
```javascript
// Manter o primeiro, desativar os duplicados
db.collection('usuarios').doc(docIdDuplicado).update({ ativo: false })
```

### Se encontrar UID faltando:
```javascript
// Adicionar o UID manualmente
db.collection('usuarios').doc(docId).update({ uid: fbUser.uid })
```

### Se encontrar responsável inválido:
```javascript
// Limpar o responsável
db.collection('processos').doc(processoId).update({ responsavel: deleteField() })
```

---

## 📝 Exemplo de Saída

```
========================================
🔥 AUDITORIA FIRESTORE V2 - SEGUNDA EXECUÇÃO
========================================

📂 Carregando dados das coleções...
✅ Usuários: 5
✅ Processos: 127
✅ Distribuições: 45
✅ Mensagens: 127
✅ Eventos: 23
✅ Configs: 1

🔐 Verificando sincronização Firebase Auth ↔ Firestore...
✅ Sincronização verificada
   ⚠️  UIDs faltando: 0
   ⚠️  Emails duplicados: 0
   ⚠️  Emails inválidos: 0
   ⚠️  Setores inválidos: 2
   ⚠️  Roles inválidas: 0

📋 Verificando integridade de Processos...
✅ Integridade de Processos verificada
   ⚠️  Responsáveis inválidos: 1
   ⚠️  Inconsistências de setor: 0

🔗 Verificando integridade de Referências...
✅ Referências verificadas
   ⚠️  Distribuições órfãs: 0
   ⚠️  Mensagens órfãs: 0
   ⚠️  Documentos órfãos: 0

📊 Gerando Relatório Final...
✅ Relatório JSON salvo: auditoria-firestore-v2.json
✅ Relatório HTML salvo: auditoria-firestore-v2.html

========================================
Total de Problemas: 3
========================================
```

---

## 🐛 Troubleshooting

**Erro: `Cannot find module 'firebase/firestore'`**
```bash
npm install firebase
```

**Erro: `FIREBASE_AUDIT_PASSWORD não informado`**
```bash
# Defina a variável de ambiente antes de rodar
export FIREBASE_AUDIT_PASSWORD="sua-senha"
node scripts/audit-firestore-v2.mjs
```

**Erro: `Permission denied`**
- O usuário usado precisa ter acesso ao Firestore
- Verifique as regras de segurança do Firestore

---

## 📞 Notas

- O script é **somente leitura** e não faz alterações nos dados
- Recomenda-se rodar antes de fazer alterações críticas no banco
- Compare com a primeira auditoria para identificar regressões
