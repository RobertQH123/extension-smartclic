import * as vscode from 'vscode';
import type { ComponentData } from '../lib/data-loader';
import { getPreviewUri } from '../lib/preview';

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
        const component = components[word];
        if (!component) { return; }

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        const imgUri = getPreviewUri(extensionUri, component.name);
        if (imgUri) { md.appendMarkdown(`<img src="${imgUri.toString(true)}" width="100%" />\n\n`); }
        md.appendMarkdown(component.description ?? '');
        return new vscode.Hover(md, wordRange);
      }
    }
  );
}
