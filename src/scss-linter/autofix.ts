import * as vscode from 'vscode';
import type { LintResult, TextFix } from './types';

// Provee acciones de código (bombilla) para diagnósticos con fix disponible.
// Recibe el WeakMap compartido con el runner de diagnósticos para obtener el fix de cada diagnóstico.
export class ScssCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private readonly fixMap: WeakMap<vscode.Diagnostic, TextFix>) {}

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    return context.diagnostics
      .filter(d => d.source === 'scss-smartclic' && this.fixMap.has(d))
      .map(d => {
        const fix = this.fixMap.get(d)!;
        const action = new vscode.CodeAction(
          `Corregir: reemplazar con \`${fix.newText}\``,
          vscode.CodeActionKind.QuickFix
        );
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, fix.range, fix.newText);
        action.diagnostics = [d];
        action.isPreferred = true;
        return action;
      });
  }
}

// Construye los TextEdit para aplicar todos los fixes automáticamente al guardar.
// Ordena en reversa para que los offsets no se desplacen al aplicar múltiples edits.
export function buildAutoFixEdits(results: LintResult[]): vscode.TextEdit[] {
  return results
    .filter(r => r.fix !== undefined)
    .sort((a, b) => {
      const ar = a.fix!.range.start;
      const br = b.fix!.range.start;
      if (br.line !== ar.line) { return br.line - ar.line; }
      return br.character - ar.character;
    })
    .map(r => vscode.TextEdit.replace(r.fix!.range, r.fix!.newText));
}
