// F7: Avisa cuando faltan los @use con los aliases correctos (vars / resol).
// El warning aparece solo en la línea del @use afectado (o línea 0 si no existe ninguno).

import * as vscode from 'vscode';
import type { LintResult } from '../types';
import type { ImportAliases } from '../utils';

export function importAliasRule(document: vscode.TextDocument, aliases: ImportAliases): LintResult[] {
  const results: LintResult[] = [];
  const text = document.getText();
  const lines = text.split('\n');

  const usesVariables = lines.some(
    l => /\$[\w-]+/.test(l) && !/^\s*\$[\w-]+\s*:/.test(l) && !/^\s*@use/.test(l)
  );
  const usesMixins = lines.some(l => /@include\b/.test(l));

  if (!aliases.hasVars && usesVariables) {
    const warnLine = aliases.varsLine >= 0 ? aliases.varsLine : (aliases.resolLine >= 0 ? aliases.resolLine : 0);
    const lineText = lines[warnLine];
    const range = new vscode.Range(warnLine, 0, warnLine, lineText.length);
    const diag = new vscode.Diagnostic(
      range,
      'Añade `@use "@/assets/styles/variables" as vars;` para usar variables del micro frontend.',
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = 'scss-smartclic';
    diag.code = 'F7';
    results.push({ diagnostic: diag });
  }

  if (!aliases.hasResol && usesMixins) {
    const warnLine = aliases.resolLine >= 0 ? aliases.resolLine : (aliases.varsLine >= 0 ? aliases.varsLine : 0);
    const lineText = lines[warnLine];
    const range = new vscode.Range(warnLine, 0, warnLine, lineText.length);
    const diag = new vscode.Diagnostic(
      range,
      'Añade `@use "@/assets/styles/mixin" as resol;` para usar mixins del micro frontend.',
      vscode.DiagnosticSeverity.Warning
    );
    diag.source = 'scss-smartclic';
    diag.code = 'F7';
    results.push({ diagnostic: diag });
  }

  return results;
}
