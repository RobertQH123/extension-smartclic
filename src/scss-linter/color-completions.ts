import * as vscode from 'vscode';
import { loadVariableMap } from './variable-parser';
import { detectImportAliases, buildVarExpr } from './utils';

// CSS properties whose value is always a color — trigger completions from first char typed
const COLOR_PROPS = new Set([
  'color', 'background-color', 'border-color',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'outline-color', 'fill', 'stroke', 'text-decoration-color',
  'caret-color', 'accent-color', 'column-rule-color',
  'background', // shorthand; only fires when value is a single word (no spaces/parens before cursor)
]);

export function registerColorCompletions(context: vscode.ExtensionContext): void {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'scss' },
    {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const lineText = document.lineAt(position).text.substring(0, position.character);

        let typed: string;
        let startChar: number;
        let filterPrefix: string; // prefix used for VS Code's filter matching

        // Case A — typing $word anywhere in a property value
        const dollarMatch = lineText.match(/:(.*)\$([\w-]*)$/);
        if (dollarMatch) {
          typed = dollarMatch[2];
          startChar = position.character - typed.length - 1; // includes the $
          filterPrefix = `$${typed}`;
        } else {
          // Case B — inside a known color property, any text typed after the colon
          // Regex: "  color: [optional-word]" — stops matching if there are spaces/parens in the value
          // (avoids firing in multi-value like "background: url(...) <cursor>")
          const propMatch = lineText.match(/^\s*([\w-]+)\s*:\s*([\w-]*)$/);
          if (!propMatch || !COLOR_PROPS.has(propMatch[1].toLowerCase())) {
            return undefined;
          }
          typed = propMatch[2];
          startChar = position.character - typed.length;
          filterPrefix = typed;
        }

        const varMap = loadVariableMap(document.uri.fsPath);
        if (!varMap) { return undefined; }

        const lines = document.getText().split('\n');
        const aliases = detectImportAliases(lines);

        const replaceRange = new vscode.Range(position.line, startChar, position.line, position.character);

        const items: vscode.CompletionItem[] = [];
        let order = 0;

        for (const [name, variable] of varMap.byName) {
          if (!variable.isColor) { continue; }

          const hasAlias = (variable.alias === 'vars' && aliases.hasVars) ||
                           (variable.alias === 'resol' && aliases.hasResol);
          const insertText = hasAlias
            ? buildVarExpr(name, variable.alias)
            : `var(--${name}, $${name})`;

          const item = new vscode.CompletionItem(
            { label: `$${name}`, description: variable.rawValue },
            vscode.CompletionItemKind.Color
          );
          item.detail = variable.rawValue;
          item.insertText = insertText;
          // filterText must match the characters already typed so VS Code keeps the item visible
          item.filterText = dollarMatch ? `$${name}` : name;
          item.sortText = `0_${String(order++).padStart(4, '0')}`;
          item.range = replaceRange;
          item.documentation = new vscode.MarkdownString().appendCodeblock(insertText, 'scss');

          items.push(item);
        }

        return items.length ? items : undefined;
      },
    }
    // No trigger characters: provider runs on every keystroke so position/range stay fresh.
  );

  context.subscriptions.push(provider);
}
