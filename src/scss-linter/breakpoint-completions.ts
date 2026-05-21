import * as vscode from 'vscode';
import { detectImportAliases } from './utils';

type BpKey = 'lg' | 'xl' | 'xxl';

const SNIPPET_PREFIXES: Record<string, BpKey[]> = {
  'bkxxl': ['xxl'],
  'bkxl':  ['xl'],
  'bklg':  ['lg'],
  'bk':    ['lg', 'xl', 'xxl'],
};

function buildSnippet(bps: BpKey[], hasResol: boolean, hasVars: boolean): vscode.SnippetString {
  const inc = hasResol ? 'resol.' : '';
  const v   = hasVars  ? 'vars.'  : '';

  const parts = bps.map((bp, i) => {
    const tab = i < bps.length - 1 ? `\${${i + 1}}` : '$0';
    return `@include ${inc}breakpoint(${v}$bp-res-${bp}, min) {\n\t${tab}\n}`;
  });

  return new vscode.SnippetString(parts.join('\n\n'));
}

export function registerBreakpointCompletions(context: vscode.ExtensionContext): void {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'scss' },
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const lineText = document.lineAt(position).text.substring(0, position.character);

        const matched = Object.keys(SNIPPET_PREFIXES).find(prefix => {
          if (!lineText.endsWith(prefix)) { return false; }
          const charBefore = lineText[lineText.length - prefix.length - 1];
          return charBefore === undefined || /\s/.test(charBefore);
        });

        if (!matched) { return undefined; }

        const lines = document.getText().split('\n');
        const aliases = detectImportAliases(lines);
        const bps = SNIPPET_PREFIXES[matched];

        const item = new vscode.CompletionItem(matched, vscode.CompletionItemKind.Snippet);
        item.insertText = buildSnippet(bps, aliases.hasResol, aliases.hasVars);
        item.detail = `Breakpoint${bps.length > 1 ? 's' : ''} Smartclic (${bps.map(b => b.toUpperCase()).join(', ')})`;
        item.filterText = matched;
        item.sortText = '0'; // aparece primero en la lista

        const startChar = position.character - matched.length;
        item.range = new vscode.Range(position.line, startChar, position.line, position.character);

        return [item];
      },
    }
  );

  context.subscriptions.push(provider);
}
