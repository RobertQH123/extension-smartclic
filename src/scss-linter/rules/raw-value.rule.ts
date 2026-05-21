// F1: Valor crudo coincide con una variable existente → error + autofix a vars.$varName
// F2: Valor crudo sin variable coincidente → error sin autofix (crear la variable)
//
// Aplica a:
//   - Valores con unidades CSS (px, %, em, rem, vw, vh, pt)
//   - Cualquier otro valor literal que coincida exactamente con una variable (box-shadow, etc.)

import * as vscode from 'vscode';
import type { LintResult } from '../types';
import type { VariableMap } from '../variable-parser';
import type { ImportAliases } from '../utils';
import { isSkippableLine, extractValueContext } from '../utils';

// Unidades CSS habituales que deben estar variabilizadas
const DIMENSION_RE = /\b(\d+(?:\.\d+)?)(px|%|em|rem|vw|vh|pt)\b/g;

export function rawValueRule(document: vscode.TextDocument, varMap: VariableMap, aliases: ImportAliases): LintResult[] {
  const results: LintResult[] = [];
  const lines = document.getText().split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (isSkippableLine(lines[i])) { continue; }

    const ctx = extractValueContext(lines[i]);
    if (!ctx) { continue; }

    const { colonIdx, value, prop } = ctx;

    // ── F1 / F2: valores con unidades ──────────────────────────────────────────
    DIMENSION_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DIMENSION_RE.exec(value)) !== null) {
      const rawVal = m[0];
      const col = colonIdx + 1 + m.index;
      const range = new vscode.Range(i, col, i, col + rawVal.length);
      const existing = varMap.byValue.get(rawVal.toLowerCase());

      if (existing && !existing.isColor) {
        // F1 — variable existente
        const prefix = aliases.hasVars ? `${existing.alias}.` : '';
        const varRef = `${prefix}$${existing.name}`;
        const diag = new vscode.Diagnostic(
          range,
          `El valor \`${rawVal}\` ya existe como \`$${existing.name}\`. Usa \`${varRef}\`.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F1';
        results.push({ diagnostic: diag, fix: { range, newText: varRef } });
      } else if (!existing) {
        // F2 — sin variable, solo reportar
        const unit = m[2];
        const hint = unit === '%' ? `$per-${m[1]}` : `$pix-${m[1]}`;
        const diag = new vscode.Diagnostic(
          range,
          `El valor \`${rawVal}\` no tiene variable. Créala como \`${hint}\` en \`_variables.scss\`.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F2';
        results.push({ diagnostic: diag });
      }
    }

    // ── F1 general: cualquier otro literal que coincida con una variable ────────
    // (ej: box-shadow, border-radius customizado, etc.)
    const lowerValue = value.toLowerCase();
    for (const [normalizedVal, variable] of varMap.byValue) {
      if (variable.isColor) { continue; }               // la regla de color lo maneja
      if (DIMENSION_RE.test(normalizedVal)) { continue; } // ya procesado arriba
      if (variable.name.endsWith('-z-index') && prop !== 'z-index') { continue; }
      if (/^weight-/.test(variable.name) && prop !== 'font-weight') { continue; }

      let searchFrom = 0;
      let idx: number;
      while ((idx = lowerValue.indexOf(normalizedVal, searchFrom)) !== -1) {
        searchFrom = idx + 1;

        // Comprobación de límite de palabra para evitar falsos positivos
        const charBefore = idx > 0 ? lowerValue[idx - 1] : ' ';
        const charAfter = idx + normalizedVal.length < lowerValue.length
          ? lowerValue[idx + normalizedVal.length]
          : ' ';
        if (/[\w-]/.test(charBefore) || /[\w-]/.test(charAfter)) { continue; }

        const col = colonIdx + 1 + idx;
        const range = new vscode.Range(i, col, i, col + normalizedVal.length);
        const prefix = aliases.hasVars ? `${variable.alias}.` : '';
        const varRef = `${prefix}$${variable.name}`;
        const diag = new vscode.Diagnostic(
          range,
          `El valor \`${variable.rawValue}\` ya existe como \`$${variable.name}\`. Usa \`${varRef}\`.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F1';
        results.push({ diagnostic: diag, fix: { range, newText: varRef } });
      }
    }
  }

  return results;
}
