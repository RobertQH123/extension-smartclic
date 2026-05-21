import * as vscode from 'vscode';
import type { ComponentData } from '../lib/data-loader';
import type { ClassEntry } from '../lib/class-loader';
import { getPreviewUri } from '../lib/preview';

// Recopila líneas hacia atrás desde la posición del cursor hasta encontrar la apertura del tag.
// Devuelve las líneas unidas con espacio, útil para buscar el tag cuando hay saltos de línea.
function buildTagContext(document: vscode.TextDocument, position: vscode.Position): string {
  const parts: string[] = [document.lineAt(position).text.substring(0, position.character)];
  for (let i = position.line - 1; i >= 0 && position.line - i <= 10; i--) {
    const line = document.lineAt(i).text;
    parts.unshift(line);
    if (/<[\w-]/.test(line)) { break; }
  }
  return parts.join(' ');
}

export function createCompletionProvider(
  extensionUri: vscode.Uri,
  getComponents: () => Record<string, ComponentData>,
  getClasses: () => ClassEntry[]
): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    [{ language: 'vue' }, { language: 'html' }],
    {
      provideCompletionItems(document, position) {
        const components = getComponents();
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        const tagContext = buildTagContext(document, position);

        // Valores de atributo → completions con imagen por variante
        const attrValueMatch = tagContext.match(/<([\w-]+)[^>]*\s([\w-:]+)="([^"]*)$/);
        if (attrValueMatch) {
          const tagName = attrValueMatch[1];
          const attrName = attrValueMatch[2];
          const attrValue = attrValueMatch[3];

          // Clases utilitarias — solo en atributo "class" y solo para elementos HTML nativos (no v-)
          if (attrName === 'class' && !tagName.startsWith('v-')) {
            const classes = getClasses();
            if (!classes.length) { return undefined; }
            const lastWord = attrValue.split(/\s+/).pop() ?? '';
            const filtered = lastWord
              ? classes.filter(c => c.name.toLowerCase().startsWith(lastWord.toLowerCase()))
              : classes;
            const replaceStart = position.character - lastWord.length;
            const range = new vscode.Range(position.line, replaceStart, position.line, position.character);
            return filtered.map((entry, i) => {
              const item = new vscode.CompletionItem(entry.name, vscode.CompletionItemKind.Value);
              item.detail = '_clases.scss';
              item.range = range;
              item.sortText = `0_${String(i).padStart(4, '0')}`;
              item.documentation = new vscode.MarkdownString(
                `\`\`\`css\n.${entry.name} {\n  ${entry.css.replace(/\n/g, '\n  ')}\n}\n\`\`\``
              );
              return item;
            });
          }

          const component = components[tagName];
          if (!component) { return undefined; }
          const attr = component.attributes.find(a => a.name === attrName);
          if (!attr?.values) { return undefined; }
          return attr.values.map((v, i) => {
            const item = new vscode.CompletionItem(v.name, vscode.CompletionItemKind.EnumMember);
            item.detail = v.description ?? '';
            item.sortText = `0_${String(i).padStart(3, '0')}`;
            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.supportHtml = true;
            const imgUri = getPreviewUri(extensionUri, component.name, v.name);
            if (imgUri) { md.appendMarkdown(`<img src="${imgUri.toString(true)}" width="100%" />\n\n`); }
            if (v.description) { md.appendMarkdown(v.description); }
            item.documentation = md;
            return item;
          });
        }

        // Nombres de atributos dentro del tag — usa contexto multi-línea para detectar el tag abierto
        const tagAttrMatch = tagContext.match(/<([\w-]+)[^>]*\s+[\w-]*$/);
        if (tagAttrMatch) {
          const component = components[tagAttrMatch[1]];
          if (!component) { return undefined; }
          return component.attributes.map((attr, i) => {
            const item = new vscode.CompletionItem(attr.name, vscode.CompletionItemKind.Property);
            const defaultLabel = attr.default !== undefined ? ` (default: ${attr.default})` : '';
            item.detail = `${attr.description ?? ''}${defaultLabel}`;
            const md = new vscode.MarkdownString(attr.description ?? '');
            if (attr.default !== undefined) { md.appendMarkdown(`\n\n**Default:** \`${attr.default}\``); }
            item.documentation = md;
            item.insertText = new vscode.SnippetString(`${attr.name}="$1"`);
            item.sortText = `0_${String(i).padStart(3, '0')}`;
            return item;
          });
        }

        // Nombre del componente
        const tagNameMatch = linePrefix.match(/<([\w-]*)$/);
        if (tagNameMatch) {
          const typed = tagNameMatch[1].toLowerCase();
          return Object.values(components)
            .filter(c => c.name.toLowerCase().startsWith(typed))
            .map(c => {
              const item = new vscode.CompletionItem(c.name, vscode.CompletionItemKind.Class);
              item.detail = 'Smartclic Component';
              const docMd = new vscode.MarkdownString();
              docMd.isTrusted = true;
              docMd.supportHtml = true;
              const compImgUri = getPreviewUri(extensionUri, c.name);
              if (compImgUri) { docMd.appendMarkdown(`<img src="${compImgUri.toString(true)}" width="100%" />\n\n`); }
              docMd.appendMarkdown(c.description ?? '');
              item.documentation = docMd;
              item.insertText = new vscode.SnippetString(`${c.name} $1/>`);
              return item;
            });
        }

        return undefined;
      }
    },
    ' ', '"', ':', '<', '-'
  );
}
