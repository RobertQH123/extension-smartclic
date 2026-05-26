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
  // \$ escapa el signo $ para que SnippetString lo trate como literal, no como tabstop/variable
  const varRef = hasVars ? 'vars.\\$bp-res-' : '\\$bp-res-';

  const parts = bps.map((bp, i) => {
    const tab = i < bps.length - 1 ? `\${${i + 1}}` : '$0';
    return `@include ${inc}breakpoint(${varRef}${bp}, min) {\n\t${tab}\n}`;
  });

  return new vscode.SnippetString(parts.join('\n\n'));
}

export function registerBreakpointCompletions(context: vscode.ExtensionContext): void {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'scss' },
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const lineText = document.lineAt(position).text.substring(0, position.character);

        // Dispara cuando la línea termina con "bk" seguido de letras opcionales (bk, bkl, bklg, bkx…)
        // y el carácter anterior es espacio o inicio de línea
        const typedMatch = lineText.match(/(?:^|(?<=\s))(bk\w*)$/);
        if (!typedMatch) { return undefined; }
        const typed = typedMatch[1];

        const lines = document.getText().split('\n');
        const aliases = detectImportAliases(lines);

        const startChar = position.character - typed.length;
        const replaceRange = new vscode.Range(position.line, startChar, position.line, position.character);

        // Retorna todos los snippets — VS Code filtra por filterText según lo que fue tipeado
        return Object.keys(SNIPPET_PREFIXES).map((prefix, order) => {
          const bps = SNIPPET_PREFIXES[prefix];
          const item = new vscode.CompletionItem(prefix, vscode.CompletionItemKind.Snippet);
          item.insertText = buildSnippet(bps, aliases.hasResol, aliases.hasVars);
          item.detail = `Breakpoint${bps.length > 1 ? 's' : ''} Smartclic (${bps.map(b => b.toUpperCase()).join(', ')})`;
          item.filterText = prefix;
          item.sortText = `0_${order}`;
          item.range = replaceRange;
          return item;
        });
      },
    }
  );

  context.subscriptions.push(provider);
}
