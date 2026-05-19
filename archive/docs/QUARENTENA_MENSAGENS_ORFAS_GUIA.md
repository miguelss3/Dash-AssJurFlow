# Guia de Quarentena de Mensagens Orfas

Este guia explica como rodar o tratamento seguro das mensagens orfas sem deletar nada da colecao original.

## Objetivo

- Evitar falso positivo quando a auditoria nao consegue ler processos
- Isolar mensagens orfas reais em mensagens_orfas
- Preservar historico original em mensagens

## Arquivos

- scripts/audit-firestore-v2.mjs
- scripts/quarantine-orphan-messages.mjs

## 1) Rodar auditoria v2 atualizada

PowerShell:

$env:FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br"; $env:FIREBASE_AUDIT_PASSWORD="SUA_SENHA"; node scripts/audit-firestore-v2.mjs

Resultado esperado:

- Se houver acesso negado em processos, o relatorio passa a registrar limitacao em metadados.acessosNegados
- mensagensOrfas nao e contabilizado como problema quando processos estiver inacessivel

## 2) Rodar quarentena em preview (sem alterar banco)

PowerShell:

$env:FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br"; $env:FIREBASE_AUDIT_PASSWORD="SUA_SENHA"; node scripts/quarantine-orphan-messages.mjs

Saida:

- Gera quarantine-orphan-messages-preview.json
- Nao grava em mensagens_orfas
- Nao deleta nada

## 3) Executar copia para quarentena

PowerShell:

$env:FIREBASE_AUDIT_EMAIL="miguelss3@yahoo.com.br"; $env:FIREBASE_AUDIT_PASSWORD="SUA_SENHA"; $env:CONFIRM_QUARANTINE="SIM"; node scripts/quarantine-orphan-messages.mjs

Saida:

- Copia mensagens orfas para mensagens_orfas com metadados de quarentena
- Mantem documentos originais em mensagens
- Gera quarantine-orphan-messages-result.json

## Importante

- O script aborta se processos estiver com permission-denied (protege contra falso positivo)
- Este fluxo nao faz reatribuicao para chefe/admin
- Este fluxo nao deleta documentos da colecao mensagens
