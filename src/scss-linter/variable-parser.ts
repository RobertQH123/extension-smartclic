import * as path from 'path';
import * as fs from 'fs';
import { stripLineComment } from './utils';

export interface ScssVariable {
  name: string;      // sin $ — ej: "pix-30"
  rawValue: string;  // ej: "30px"
  isColor: boolean;
  alias: string;     // "vars" o "resol"
}

export interface VariableMap {
  byValue: Map<string, ScssVariable>;        // valor normalizado → primera variable declarada
  byValueAll: Map<string, ScssVariable[]>;   // valor normalizado → todas las variables con ese valor
  byName: Map<string, ScssVariable>;         // nombre → variable
}

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const FUNC_COLOR_RE = /^(?:rgb|rgba|hsl|hsla)\(/i;

export function isColorValue(value: string): boolean {
  const t = value.trim();
  return HEX_RE.test(t) || FUNC_COLOR_RE.test(t);
}

function normalizeHex(hex: string): string {
  const h = hex.toLowerCase();
  if (h.length === 4) {
    return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return h;
}

export function normalizeValue(value: string): string {
  const t = value.trim();
  if (HEX_RE.test(t)) { return normalizeHex(t); }
  return t.toLowerCase();
}

export function parseVariables(content: string, alias: string): VariableMap {
  const byValue    = new Map<string, ScssVariable>();
  const byValueAll = new Map<string, ScssVariable[]>();
  const byName     = new Map<string, ScssVariable>();

  const cleanedLines = content.split('\n').map(stripLineComment);
  const cleaned = cleanedLines.join('\n');

  const re = /^\s*\$([\w-]+)\s*:\s*([^;]+?)\s*;/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const name = m[1];
    const rawValue = m[2].trim();
    if (rawValue.startsWith('$') || rawValue.includes('#{')) { continue; }

    const variable: ScssVariable = { name, rawValue, isColor: isColorValue(rawValue), alias };
    byName.set(name, variable);

    const key = normalizeValue(rawValue);
    // byValue preserva la primera declaración (determinístico por orden de archivo)
    if (!byValue.has(key)) { byValue.set(key, variable); }
    // byValueAll acumula todos los candidatos para el mismo valor
    const existing = byValueAll.get(key);
    if (existing) { existing.push(variable); } else { byValueAll.set(key, [variable]); }
  }

  return { byValue, byValueAll, byName };
}

function findStylesFile(scssFilePath: string, fileName: string): string | null {
  let dir = path.dirname(scssFilePath);
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'src', 'assets', 'styles', fileName);
    if (fs.existsSync(candidate)) { return candidate; }
    const parent = path.dirname(dir);
    if (parent === dir) { break; }
    dir = parent;
  }
  return null;
}

export function findVariablesFile(scssFilePath: string): string | null {
  return findStylesFile(scssFilePath, '_variables.scss');
}

export function loadVariableMap(scssFilePath: string): VariableMap | null {
  const varFile = findVariablesFile(scssFilePath);
  if (!varFile) { return null; }

  try {
    const map = parseVariables(fs.readFileSync(varFile, 'utf8'), 'vars');

    // También carga _mixin.scss si existe (alias 'resol'); no sobreescribe vars
    const mixinFile = findStylesFile(scssFilePath, '_mixin.scss');
    if (mixinFile) {
      const mixinMap = parseVariables(fs.readFileSync(mixinFile, 'utf8'), 'resol');
      for (const [k, v] of mixinMap.byName) {
        if (!map.byName.has(k)) { map.byName.set(k, v); }
      }
      for (const [k, v] of mixinMap.byValue) {
        if (!map.byValue.has(k)) { map.byValue.set(k, v); }
      }
      for (const [k, vs] of mixinMap.byValueAll) {
        const existing = map.byValueAll.get(k);
        if (existing) {
          for (const v of vs) { if (!existing.some(e => e.name === v.name)) { existing.push(v); } }
        } else {
          map.byValueAll.set(k, [...vs]);
        }
      }
    }

    return map;
  } catch {
    return null;
  }
}
