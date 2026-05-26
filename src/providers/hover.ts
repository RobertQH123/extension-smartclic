import * as vscode from 'vscode';
import type { ComponentData } from '../lib/data-loader';
import { getPreviewUri } from '../lib/preview';

function findEnclosingTag(document: vscode.TextDocument, position: vscode.Position): string | null {
  for (let i = position.line; i >= 0 && position.line - i <= 10; i--) {
    const text = i === position.line
      ? document.lineAt(i).text.substring(0, position.character)
      : document.lineAt(i).text;
    const lastOpen = text.lastIndexOf('<');
    if (lastOpen !== -1 && text.indexOf('>', lastOpen) === -1) {
      const m = text.substring(lastOpen + 1).match(/^([\w-]+)/);
      return m ? m[1] : null;
    }
  }
  return null;
}

export function createHoverProvider(
  extensionUri: vscode.Uri,
  getComponents: () => Record<string, ComponentData>
): vscode.Disposable {
  return vscode.languages.registerHoverProvider(
    [{ language: 'vue' }, { language: 'html' }],
    {
      provideHover(document, position) {
        const components = getComponents();
        const wordRange = document.getWordRangeAtPosition(position, /[\w-]+/);
        if (!wordRange) { return; }
        const word = document.getText(wordRange);

        // ── Hover sobre nombre de componente ─────────────────────────────────
        const component = components[word];
        if (component) {
          const md = new vscode.MarkdownString();
          md.isTrusted = true;
          md.supportHtml = true;
          const imgUri = getPreviewUri(extensionUri, component.name);
          if (imgUri) { md.appendMarkdown(`<img src="${imgUri.toString(true)}" width="100%" />\n\n`); }
          md.appendMarkdown(component.description ?? '');
          if (component.slots?.length) {
            const slotList = component.slots
              .map(s => `- \`#${s.name}\`${s.description ? ` — ${s.description}` : ''}`)
              .join('\n');
            md.appendMarkdown(`\n\n**Slots:**\n${slotList}`);
          }
          return new vscode.Hover(md, wordRange);
        }

        // ── Hover sobre atributo o valor de atributo ──────────────────────────
        const tagName = findEnclosingTag(document, position);
        if (!tagName) { return; }
        const comp = components[tagName];
        if (!comp) { return; }

        const lineText = document.lineAt(position).text;
        const beforeCursor = lineText.substring(0, position.character);

        // ¿Estamos dentro de las comillas de un valor? → busca attrName="...cursor...
        const insideValueMatch = beforeCursor.match(/\s([\w:-]+)="([^"]*)$/);
        if (insideValueMatch) {
          const attrName = insideValueMatch[1];
          const attr = comp.attributes.find(a => a.name === attrName);
          if (!attr?.values) { return; }
          const value = attr.values.find(v => v.name === word);
          if (!value) { return; }
          const md = new vscode.MarkdownString();
          md.isTrusted = true;
          md.supportHtml = true;
          const imgUri = getPreviewUri(extensionUri, comp.name, value.name);
          if (imgUri) { md.appendMarkdown(`<img src="${imgUri.toString(true)}" width="100%" />\n\n`); }
          if (value.description) { md.appendMarkdown(value.description); }
          else { md.appendMarkdown(`\`${attrName}="${value.name}"\``); }
          return new vscode.Hover(md, wordRange);
        }

        // ¿El cursor está sobre un nombre de atributo?
        const attr = comp.attributes.find(a => a.name === word);
        if (!attr) { return; }
        const md = new vscode.MarkdownString();
        if (attr.description) { md.appendMarkdown(attr.description); }
        if (attr.default !== undefined) { md.appendMarkdown(`\n\n**Default:** \`${attr.default}\``); }
        if (attr.values?.length) {
          const valList = attr.values.map(v => `\`${v.name}\``).join(' · ');
          md.appendMarkdown(`\n\n**Valores:** ${valList}`);
        }
        return new vscode.Hover(md, wordRange);
      }
    }
  );
}
