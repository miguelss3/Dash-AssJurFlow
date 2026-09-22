# Copiar Documento (SIGADEX/PDF.js)

Extensão de navegador (Chrome/Edge) que corrige o espaçamento perdido ao
copiar texto de documentos PDF renderizados no SIGADEX (ou qualquer outro
visualizador baseado em PDF.js) — as palavras que colavam ("nosautos",
"arquivoeditável" etc.) passam a sair separadas corretamente, com quebras de
parágrafo restauradas.

## Como instalar

### Firefox

1. Abra `about:debugging#/runtime/this-firefox` na barra de endereço.
2. Clique em **"Carregar extensão temporária"** ("Load Temporary Add-on...").
3. Selecione o arquivo `manifest.json` **dentro** desta pasta (não a pasta
   em si — no Firefox é o arquivo).
4. Fixe o ícone (opcional) clicando no ícone de extensões (peça de
   quebra-cabeça) na barra e depois no alfinete ao lado do nome dela.

**Atenção, particularidades do Firefox:**
- É uma extensão **temporária** — some quando o Firefox fecha. Toda vez que
  reabrir o navegador, repita os passos acima.
- Depois de qualquer atualização do código (como agora): volte em
  `about:debugging#/runtime/this-firefox`, ache a extensão e clique em
  **"Recarregar"** ("Reload").
- **Importante:** recarregar a extensão só afeta abas novas/recarregadas —
  se o SPED já estava aberto numa aba antes do reload, dê F5 nela depois de
  recarregar a extensão para o botão aparecer.

### Chrome / Edge

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative o **"Modo do desenvolvedor"** (canto superior direito).
3. Clique em **"Carregar sem compactação"** ("Load unpacked").
4. Selecione esta pasta (`browser-extension/copiar-sigadex`) — aqui sim é a
   pasta inteira, não o arquivo.
5. Fixe o ícone na barra de ferramentas (peça de quebra-cabeça → alfinete).
6. Aqui a extensão fica instalada normalmente (não é temporária), mas a
   mesma regra de "recarregar a extensão não afeta abas já abertas" vale
   também.

## Como usar

**No SPED (`sped.12rm.eb.mil.br`):** basta abrir o documento — um botão
**"Copiar p/ AssJurFlow"** aparece sozinho, fixo no canto inferior direito da
tela. Clique nele e já copia (o próprio botão vira "Copiado!" por 2s como
confirmação). Depois é só colar (Ctrl+V) no campo "Observações/Informações
iniciais" do AssJurFlow.

**Em qualquer outra página com PDF.js** (o botão automático só funciona no
domínio acima): clique no ícone da extensão na barra do navegador e depois em
"Copiar documento formatado" — faz a mesma coisa, só com um clique a mais.

Negrito, itálico e outras formatações visuais **não são recuperados** — essa
informação existe só no desenho da página (imagem), não no texto
selecionável do PDF.js. Isso continua exigindo ajuste manual quando
necessário.

## O que é recortado automaticamente

Só o miolo útil do DIEx é copiado — brasão/cabeçalho, "URGENTE", linhas
"Da"/"Ao" (remetente/destinatário), assinatura, lema e rodapé de página ficam
de fora. O corte usa padrões de texto do próprio documento (não a posição),
então funciona em qualquer DIEx, não só num modelo específico:

- Começa a copiar a partir da linha "DIEx nº ..." ou "Ofício nº ...".
- Termina antes de "Atenciosamente,"/"Respeitosamente,"/"Cordialmente,".
- Dentro desse intervalo, descarta linhas que comecem com "URGENTE", "Da "/
  "Do " ou "Ao "/"Aos ".

Se esses marcadores não forem encontrados no documento, nada é cortado — a
extensão prefere devolver texto a mais a arriscar apagar conteúdo real.

## Observação

O botão automático só é injetado em `sped.12rm.eb.mil.br` (domínio
configurado em `manifest.json`). Em qualquer outra página, a extensão fica
parada — só age quando você clica no ícone dela manualmente.

O botão é injetado por **dois caminhos redundantes**: a forma declarativa
(`content_scripts` no manifest, que o próprio navegador injeta ao carregar a
página) e um `background.js` que reinjeta explicitamente toda vez que a aba
do SPED termina de carregar (`tabs.onUpdated`). O segundo existia porque, em
alguns casos no Firefox, a injeção declarativa sozinha não disparava de
forma confiável num F5 — com os dois juntos, o botão deve aparecer sempre.
`content.js` se protege contra rodar duas vezes na mesma página (não cria
botão/observer duplicado se as duas vias disparado).

Erros no console do tipo `e.detalhe.status is undefined`, `apenasVisualizacao`
ou `textLayerDiv.nextElementSibling is null` são bugs internos do próprio
SIGADEX (aparecem nos arquivos `main.js`/`54.js` do site) — não têm relação
com esta extensão.
