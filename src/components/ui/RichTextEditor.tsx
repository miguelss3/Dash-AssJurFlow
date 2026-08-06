import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minRows?: number;
}

const TOOLBAR_ITEMS = [
  { title: "Negrito (Ctrl+B)", command: "bold", icon: Bold },
  { title: "Itálico (Ctrl+I)", command: "italic", icon: Italic },
  { title: "Sublinhado (Ctrl+U)", command: "underline", icon: Underline },
  { title: "Tachado", command: "strikethrough", icon: Strikethrough },
  null, // separator
  { title: "Lista com marcadores", command: "insertUnorderedList", icon: List },
  { title: "Lista numerada", command: "insertOrderedList", icon: ListOrdered },
] as const;

function isEmptyHtml(html: string): boolean {
  return !html || html === "<br>" || html === "<div><br></div>" || html.trim() === "";
}

// Tags que o editor sabe exibir/gerar pela própria barra de ferramentas.
// Preserva a formatação e as quebras de linha em blocos (parágrafos/listas)
// de conteúdo colado; qualquer outra tag (script, style, img, table, a,
// iframe, atributos style/on*, etc.) é removida — evita tanto lixo visual
// quanto injeção de HTML/XSS vindo de fora do site.
const TAGS_PERMITIDAS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "UL", "OL", "LI", "BR", "DIV", "P", "SPAN",
]);
// Tags cujo conteúdo também deve ser descartado (não só a tag em si).
const TAGS_REMOVER_CONTEUDO = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "NOSCRIPT", "SVG"]);

function sanitizarHtmlColado(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const limpar = (raiz: Element) => {
    Array.from(raiz.childNodes).forEach((no) => {
      if (no.nodeType === Node.TEXT_NODE) return;
      if (no.nodeType !== Node.ELEMENT_NODE) {
        no.parentNode?.removeChild(no);
        return;
      }
      const el = no as HTMLElement;
      if (TAGS_REMOVER_CONTEUDO.has(el.tagName)) {
        el.remove();
        return;
      }
      // Remove todos os atributos (style, class, href, src, on*...) — só o
      // texto e a estrutura de blocos/formatação básica são preservados.
      Array.from(el.attributes).forEach((attr) => el.removeAttribute(attr.name));
      if (!TAGS_PERMITIDAS.has(el.tagName)) {
        // Tag não suportada (ex: <a>, <img>, <table>, <h1>): "desembrulha",
        // mantendo o texto/filhos no lugar dela para não perder conteúdo.
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
        el.remove();
        return;
      }
      limpar(el);
    });
  };

  limpar(doc.body);
  return doc.body.innerHTML;
}

function escapeHtml(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite aqui...",
  minRows = 3,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef(value);

  // Sincroniza valor externo (ex: carregar processo) sem mover cursor
  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== lastHtmlRef.current) {
      editorRef.current.innerHTML = value || "";
      lastHtmlRef.current = value;
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const clean = isEmptyHtml(html) ? "" : html;
    lastHtmlRef.current = clean;
    onChange(clean);
  };

  const execCmd = (command: string) => {
    editorRef.current?.focus();
    // execCommand é deprecated mas universalmente suportado para este caso de uso
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(command, false);
  };

  // Sem este handler, o navegador decide sozinho como colar — em conteúdo
  // vindo de fora (ex: visualizador de documento do SPED) isso costuma
  // descartar negrito/quebras de linha por bloco, colando tudo em uma linha
  // só. Aqui priorizamos o HTML do clipboard (sanitizado) para preservar
  // parágrafos/listas/negrito; se só houver texto puro, cada quebra de
  // linha vira um <br> explícito.
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const texto = e.clipboardData.getData("text/plain");

    const htmlParaInserir = html.trim()
      ? sanitizarHtmlColado(html)
      : texto.split(/\r\n|\r|\n/).map(escapeHtml).join("<br>");

    if (!htmlParaInserir.trim()) return;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand("insertHTML", false, htmlParaInserir);
    handleInput();
  };

  const minHeight = `${minRows * 1.6}rem`;

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background focus-within:ring-1 focus-within:ring-ring transition-shadow">
      {/* Barra de ferramentas */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-input bg-muted/30 flex-wrap">
        {TOOLBAR_ITEMS.map((item, idx) => {
          if (item === null) {
            return <span key={`sep-${idx}`} className="w-px h-4 bg-border mx-0.5" />;
          }
          const Icon = item.icon;
          return (
            <button
              key={item.command}
              type="button"
              title={item.title}
              onMouseDown={(e) => {
                e.preventDefault(); // evita perder o foco e a seleção
                execCmd(item.command);
              }}
              className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>

      {/* Área de edição */}
      <div className="relative">
        {isEmptyHtml(value) && (
          <span className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onPaste={handlePaste}
          style={{ minHeight }}
          className="px-3 py-2 text-sm outline-none leading-relaxed
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
            [&_b]:font-bold [&_strong]:font-bold
            [&_i]:italic [&_em]:italic
            [&_u]:underline
            [&_s]:line-through [&_strike]:line-through"
        />
      </div>
    </div>
  );
}
