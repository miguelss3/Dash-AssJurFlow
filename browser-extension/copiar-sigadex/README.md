# Copiar Documento (SIGADEX/PDF.js)

Extensão de navegador (Chrome/Edge) que corrige o espaçamento perdido ao
copiar texto de documentos PDF renderizados no SIGADEX (ou qualquer outro
visualizador baseado em PDF.js) — as palavras que colavam ("nosautos",
"arquivoeditável" etc.) passam a sair separadas corretamente, com quebras de
parágrafo restauradas.

## Como instalar

1. Abra `chrome://extensions` (ou `edge://extensions`, se usar o Edge).
2. Ative o **"Modo do desenvolvedor"** (canto superior direito).
3. Clique em **"Carregar sem compactação"** ("Load unpacked").
4. Selecione esta pasta (`browser-extension/copiar-sigadex`).
5. Fixe o ícone da extensão na barra de ferramentas (ícone de peça de
   quebra-cabeça → alfinete ao lado do nome da extensão), para ficar sempre
   visível.

## Como usar

1. Abra o documento no SIGADEX normalmente (o PDF precisa estar
   carregado/visível na tela).
2. Clique no ícone da extensão.
3. Clique em **"Copiar documento formatado"**.
4. Cole (Ctrl+V) no campo "Observações/Informações iniciais" do AssJurFlow —
   o texto já sai com os espaços e parágrafos corretos.

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

A extensão só age quando você clica no botão — não roda sozinha em segundo
plano nem em outras páginas.
