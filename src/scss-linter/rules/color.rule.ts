// F4: Color hex/rgb hardcodeado con variable existente → error + autofix a var(--name, alias.$name)
// F5: Color hex/rgb hardcodeado sin variable → error sin autofix
// F6: alias.$colorVar usado sin envoltura var() → error + autofix a var(--name, alias.$name)
// F6b: $colorVar bare sin alias (cuando no hay @use vars) → error + autofix a var(--name, $name)

import * as vscode from 'vscode';
import type { LintResult } from '../types';
import type { VariableMap } from '../variable-parser';
import type { ImportAliases } from '../utils';
import { normalizeValue } from '../variable-parser';
import { isSkippableLine, extractValueContext, isInsideVarCall, buildVarExpr } from '../utils';

const HEX_RE = /#([0-9a-fA-F]{3,8})\b/g;
const FUNC_COLOR_RE = /(?:rgba?|hsla?)\([^)]+\)/gi;
// Detecta referencias con cualquier alias reconocido: vars.$name o resol.$name
const ALIAS_COLOR_REF_RE = /(?:vars|resol)\.\$([\w-]+)/g;
// Detecta $varName bare (no precedido por punto ni letra, para no rematchar vars.$name)
const BARE_VAR_RE = /(?<![.\w])\$([\w-]+)/g;
// Detecta declaraciones locales $var: value para excluirlas
const LOCAL_DECL_RE = /^\s*\$([\w-]+)\s*:/;

export function colorRule(document: vscode.TextDocument, varMap: VariableMap, aliases: ImportAliases): LintResult[] {
  const results: LintResult[] = [];
  const lines = document.getText().split('\n');

  // Variables locales del archivo — no reportar F6b sobre ellas
  const localVars = new Set<string>();
  for (const line of lines) {
    const lm = LOCAL_DECL_RE.exec(line);
    if (lm) { localVars.add(lm[1]); }
  }

  for (let i = 0; i < lines.length; i++) {
    if (isSkippableLine(lines[i])) { continue; }

    const ctx = extractValueContext(lines[i]);
    if (!ctx) { continue; }

    const { colonIdx, value } = ctx;

    // ── F4 / F5: colores hex hardcodeados ──────────────────────────────────────
    HEX_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = HEX_RE.exec(value)) !== null) {
      const rawColor = m[0];
      const normalized = normalizeValue(rawColor);
      const col = colonIdx + 1 + m.index;
      const range = new vscode.Range(i, col, i, col + rawColor.length);
      const existing = varMap.byValue.get(normalized);

      if (existing?.isColor) {
        // F4 — existe variable de color
        const newText = buildVarExpr(existing.name, existing.alias);
        const diag = new vscode.Diagnostic(
          range,
          `El color \`${rawColor}\` existe como \`$${existing.name}\`. Usa \`${newText}\`.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F4';
        results.push({ diagnostic: diag, fix: { range, newText } });
      } else {
        // F5 — sin variable de color
        const diag = new vscode.Diagnostic(
          range,
          `El color \`${rawColor}\` no tiene variable. Créala en \`_variables.scss\` o usa una existente.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F5';
        results.push({ diagnostic: diag });
      }
    }

    // ── F4 / F5: colores funcionales hardcodeados (rgb, rgba, hsl, hsla) ─────────
    FUNC_COLOR_RE.lastIndex = 0;
    while ((m = FUNC_COLOR_RE.exec(value)) !== null) {
      const rawColor = m[0];
      const normalized = normalizeValue(rawColor);
      const col = colonIdx + 1 + m.index;
      const range = new vscode.Range(i, col, i, col + rawColor.length);
      const existing = varMap.byValue.get(normalized);

      if (existing?.isColor) {
        const newText = buildVarExpr(existing.name, existing.alias);
        const diag = new vscode.Diagnostic(
          range,
          `El color \`${rawColor}\` existe como \`$${existing.name}\`. Usa \`${newText}\`.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F4';
        results.push({ diagnostic: diag, fix: { range, newText } });
      } else {
        const diag = new vscode.Diagnostic(
          range,
          `El color \`${rawColor}\` no tiene variable. Créala en \`_variables.scss\` o usa una existente.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F5';
        results.push({ diagnostic: diag });
      }
    }

    // ── F6: alias.$colorVar sin envoltura var() ─────────────────────────────────
    ALIAS_COLOR_REF_RE.lastIndex = 0;
    while ((m = ALIAS_COLOR_REF_RE.exec(value)) !== null) {
      const varName = m[1];
      const variable = varMap.byName.get(varName);
      if (!variable?.isColor) { continue; }

      const textBefore = value.substring(0, m.index);
      if (isInsideVarCall(textBefore)) { continue; }

      const col = colonIdx + 1 + m.index;
      const fullRef = m[0]; // "vars.$varName" o "resol.$varName"
      const range = new vscode.Range(i, col, i, col + fullRef.length);
      const newText = buildVarExpr(varName, variable.alias);

      const diag = new vscode.Diagnostic(
        range,
        `El color \`${fullRef}\` debe usarse con \`var()\`. Usa \`${newText}\`.`,
        vscode.DiagnosticSeverity.Error
      );
      diag.source = 'scss-smartclic';
      diag.code = 'F6';
      results.push({ diagnostic: diag, fix: { range, newText } });
    }

    // ── F6b: $colorVar bare sin alias (solo cuando no hay @use vars) ────────────
    // Cuando hay alias, F3 en alias.rule ya lo cubre con fix directo a var().
    if (!aliases.hasVars) {
      BARE_VAR_RE.lastIndex = 0;
      while ((m = BARE_VAR_RE.exec(value)) !== null) {
        const varName = m[1];
        if (localVars.has(varName)) { continue; }

        const variable = varMap.byName.get(varName);
        if (!variable?.isColor) { continue; }

        const textBefore = value.substring(0, m.index);
        if (isInsideVarCall(textBefore)) { continue; }

        const col = colonIdx + 1 + m.index;
        const range = new vscode.Range(i, col, i, col + m[0].length);
        // Sin alias: var(--name, $name)  — el alias del varMap no aplica aquí
        const newText = `var(--${varName}, $${varName})`;

        const diag = new vscode.Diagnostic(
          range,
          `El color \`$${varName}\` debe usarse con \`var()\`. Usa \`${newText}\`.`,
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F6';
        results.push({ diagnostic: diag, fix: { range, newText } });
      }
    }
  }

  return results;
}
