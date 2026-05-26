import * as vscode from 'vscode';
import { loadVariableMap } from './variable-parser';
import { isSkippableLine, extractValueContext } from './utils';

// Detecta referencias con cualquier alias reconocido: vars.$name o resol.$name
const ALIAS_COLOR_RE = /(?:vars|resol)\.\$([\w-]+)/g;
// Detecta $name bare (no precedido por punto ni letra, para no rematchar vars.$name)
const BARE_COLOR_VAR_RE = /(?<![.\w])\$([\w-]+)/g;

function parseColor(rawValue: string): vscode.Color | null {
  const t = rawValue.trim();

  if (t.startsWith('#')) {
    const hex = t.slice(1);
    const full = hex.length === 3
      ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      : hex.length === 6 || hex.length === 8 ? hex : null;
    if (!full) { return null; }
    return new vscode.Color(
      parseInt(full.slice(0, 2), 16) / 255,
      parseInt(full.slice(2, 4), 16) / 255,
      parseInt(full.slice(4, 6), 16) / 255,
      full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1
    );
  }

  const rgba = t.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    return new vscode.Color(
      parseInt(rgba[1]) / 255,
      parseInt(rgba[2]) / 255,
      parseInt(rgba[3]) / 255,
      rgba[4] !== undefined ? parseFloat(rgba[4]) : 1
    );
  }

  return null;
}

export class ScssColorProvider implements vscode.DocumentColorProvider {
  provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
    const varMap = loadVariableMap(document.uri.fsPath);
    if (!varMap) { return []; }

    const result: vscode.ColorInformation[] = [];
    const lines = document.getText().split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (isSkippableLine(lines[i])) { continue; }
      const ctx = extractValueContext(lines[i]);
      if (!ctx) { continue; }
      const { colonIdx, value } = ctx;

      let m: RegExpExecArray | null;

      // vars.$name / resol.$name references
      ALIAS_COLOR_RE.lastIndex = 0;
      while ((m = ALIAS_COLOR_RE.exec(value)) !== null) {
        const variable = varMap.byName.get(m[1]);
        if (!variable?.isColor) { continue; }
        const color = parseColor(variable.rawValue);
        if (!color) { continue; }
        const col = colonIdx + 1 + m.index;
        result.push(new vscode.ColorInformation(new vscode.Range(i, col, i, col + m[0].length), color));
      }

      // bare $name references (files without @use alias)
      BARE_COLOR_VAR_RE.lastIndex = 0;
      while ((m = BARE_COLOR_VAR_RE.exec(value)) !== null) {
        const variable = varMap.byName.get(m[1]);
        if (!variable?.isColor) { continue; }
        const color = parseColor(variable.rawValue);
        if (!color) { continue; }
        const col = colonIdx + 1 + m.index;
        result.push(new vscode.ColorInformation(new vscode.Range(i, col, i, col + m[0].length), color));
      }
    }

    return result;
  }

  provideColorPresentations(
    _color: vscode.Color,
    context: { document: vscode.TextDocument; range: vscode.Range }
  ): vscode.ColorPresentation[] {
    // El color es read-only: devolvemos el texto actual para que el picker
    // muestre el swatch pero no reemplace la referencia con un hex literal.
    const currentText = context.document.getText(context.range);
    return [new vscode.ColorPresentation(currentText)];
  }
}
