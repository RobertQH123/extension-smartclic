// F3: Detecta variables SCSS usadas sin alias reconocido o con alias incorrecto.
// Correcto:   vars.$pix-30  /  resol.$bp-res-lg
// Incorrecto: $pix-30  /  v.$pix-30  /  variables.$pix-30
// Si el archivo no importa "variables as vars", los errores por línea se omiten (F7 los cubre).
// También detecta @include breakpoint sin el alias resol correcto.

import * as vscode from 'vscode';
import type { LintResult } from '../types';
import type { VariableMap } from '../variable-parser';
import type { ImportAliases } from '../utils';
import { stripLineComment, isSkippableLine, buildVarExpr } from '../utils';

const VALID_ALIASES = new Set(['vars', 'resol']);
const LOCAL_VAR_RE = /^\s*\$([\w-]+)\s*:/;
const BREAKPOINT_RE = /@include\s+(?:(\w+)\.)?breakpoint\s*\(/g;

function collectLocalVars(lines: string[]): Set<string> {
  const locals = new Set<string>();
  for (const line of lines) {
    const m = LOCAL_VAR_RE.exec(line);
    if (m) { locals.add(m[1]); }
  }
  return locals;
}

export function aliasRule(document: vscode.TextDocument, aliases: ImportAliases, varMap?: VariableMap): LintResult[] {
  const results: LintResult[] = [];
  const lines = document.getText().split('\n');
  const localVars = collectLocalVars(lines);

  for (let i = 0; i < lines.length; i++) {
    const line = stripLineComment(lines[i]);
    if (isSkippableLine(lines[i])) { continue; }

    // ── F3: variables sin alias correcto ─────────────────────────────────────
    // Si no hay import de vars, el warning F7 en la importación lo cubre; no marcar por línea
    if (aliases.hasVars) {
      const re = /(?:(\w+)\.)?\$([\w-]+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const alias = m[1];
        const varName = m[2];

        if (alias && VALID_ALIASES.has(alias)) { continue; }
        if (!alias && localVars.has(varName)) { continue; }

        const col = m.index;
        const len = m[0].length;
        const range = new vscode.Range(i, col, i, col + len);

        const variable = varMap?.byName.get(varName);
        const correctAlias = variable?.alias ?? 'vars';

        // Para colores el formato correcto es var(--name, alias.$name), no solo alias.$name
        const fix = variable?.isColor
          ? buildVarExpr(varName, correctAlias)
          : `${correctAlias}.$${varName}`;

        const msg = alias
          ? `Alias \`${alias}\` incorrecto. Usa \`${fix}\`.`
          : `Variable \`$${varName}\` sin alias. Usa \`${fix}\`.`;

        const diag = new vscode.Diagnostic(range, msg, vscode.DiagnosticSeverity.Error);
        diag.source = 'scss-smartclic';
        diag.code = 'F3';
        results.push({ diagnostic: diag, fix: { range, newText: fix } });
      }
    }

    // ── F3: @include breakpoint — namespace según alias resol ─────────────────
    BREAKPOINT_RE.lastIndex = 0;
    let bm: RegExpExecArray | null;
    while ((bm = BREAKPOINT_RE.exec(line)) !== null) {
      const usedNs = bm[1];
      const fullMatch = bm[0];
      const col = bm.index;
      const range = new vscode.Range(i, col, i, col + fullMatch.length);

      if (aliases.hasResol && !usedNs) {
        const fix = fullMatch.replace('@include breakpoint', '@include resol.breakpoint');
        const diag = new vscode.Diagnostic(
          range,
          'Usa `@include resol.breakpoint(...)` con el alias correcto.',
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F3';
        results.push({ diagnostic: diag, fix: { range, newText: fix } });
      } else if (!aliases.hasResol && usedNs === 'resol') {
        const fix = fullMatch.replace('@include resol.breakpoint', '@include breakpoint');
        const diag = new vscode.Diagnostic(
          range,
          'Sin alias `resol`, usa `@include breakpoint(...)` directamente.',
          vscode.DiagnosticSeverity.Error
        );
        diag.source = 'scss-smartclic';
        diag.code = 'F3';
        results.push({ diagnostic: diag, fix: { range, newText: fix } });
      }
    }
  }

  return results;
}
