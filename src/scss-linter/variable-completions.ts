import * as vscode from 'vscode';
import { loadVariableMap } from './variable-parser';
import { detectImportAliases } from './utils';

export function registerVariableCompletions(context: vscode.ExtensionContext): void {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'scss' },
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const lineText = document.lineAt(position).text.substring(0, position.character);

        let typed: string;
        let startChar: number;
        let isDollarCase = false;

        // Case A: user is typing $varname anywhere in a property value
        const dollarMatch = lineText.match(/:(.*)\$([\w-]*)$/);
        if (dollarMatch) {
          typed = dollarMatch[2];
          startChar = position.character - typed.length - 1; // include the leading $
          isDollarCase = true;
        } else {
          // Case B: value typed so far is digits/dots only (or empty) — e.g. "height: 32" or "height: "
          const valueMatch = lineText.match(/^\s*[\w-]+\s*:\s*([\d.]*)$/);
          if (!valueMatch) { return undefined; }
          typed = valueMatch[1];
          startChar = position.character - typed.length;
        }

        const varMap = loadVariableMap(document.uri.fsPath);
        if (!varMap) { return undefined; }

        const lines = document.getText().split('\n');
        const aliases = detectImportAliases(lines);

        const replaceRange = new vscode.Range(
          position.line, startChar,
          position.line, position.character
        );

        const items: vscode.CompletionItem[] = [];
        let order = 0;

        for (const [name, variable] of varMap.byName) {
          if (variable.isColor) { continue; }

          const hasAlias = (variable.alias === 'vars' && aliases.hasVars) ||
                           (variable.alias === 'resol' && aliases.hasResol);
          const insertText = hasAlias ? `${variable.alias}.$${name}` : `$${name}`;

          const item = new vscode.CompletionItem(
            { label: `$${name}`, description: variable.rawValue },
            vscode.CompletionItemKind.Variable
          );
          item.detail = variable.rawValue;
          item.insertText = insertText;
          item.filterText = isDollarCase ? `$${name}` : variable.rawValue;
          item.sortText = `1_${String(order++).padStart(4, '0')}`;
          item.range = replaceRange;
          item.documentation = new vscode.MarkdownString().appendCodeblock(insertText, 'scss');

          items.push(item);
        }

        return items.length ? items : undefined;
      },
    }
  );

  context.subscriptions.push(provider);
}
