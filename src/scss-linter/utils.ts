// Utilidades de parsing de líneas SCSS compartidas entre reglas

export interface ImportAliases {
  hasVars: boolean;
  hasResol: boolean;
  varsLine: number;   // línea del @use de variables (cualquier alias), -1 si no existe
  resolLine: number;  // línea del @use de mixin (cualquier alias), -1 si no existe
}

export function detectImportAliases(lines: string[]): ImportAliases {
  let hasVars = false, hasResol = false;
  let varsLine = -1, resolLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/@use\s+['"].*variables['"]/.test(line)) {
      varsLine = i;
      if (/as\s+vars\b/.test(line)) { hasVars = true; }
    }
    if (/@use\s+['"].*mixin['"]/.test(line)) {
      resolLine = i;
      if (/as\s+resol\b/.test(line)) { hasResol = true; }
    }
  }
  return { hasVars, hasResol, varsLine, resolLine };
}

export function stripLineComment(line: string): string {
  const idx = line.indexOf('//');
  return idx >= 0 ? line.substring(0, idx) : line;
}

// Líneas que deben omitirse completamente en todas las reglas
export function isSkippableLine(line: string): boolean {
  const trimmed = stripLineComment(line).trim();
  if (!trimmed) { return true; }
  if (/^\s*@(?:use|forward|import|mixin|function|keyframes)/.test(line)) { return true; }
  if (/^\s*\$[\w-]+\s*:/.test(line)) { return true; } // declaración de variable
  if (/^\s*\/[/*]/.test(line)) { return true; }        // comentario de línea o bloque
  return false;
}

// Devuelve el índice de ':' y el texto del valor si la línea parece una declaración de propiedad CSS.
// Retorna null para selectores, includes, o líneas sin valor asignable.
export function extractValueContext(line: string): { colonIdx: number; value: string; prop: string } | null {
  const stripped = stripLineComment(line);
  const colonIdx = stripped.indexOf(':');
  if (colonIdx === -1) { return null; }

  const beforeColon = stripped.substring(0, colonIdx).trim();
  const afterColon = stripped.substring(colonIdx + 1);

  // Selector → el bloque abre con {
  if (afterColon.includes('{')) { return null; }

  // El nombre de la propiedad CSS solo contiene letras, dígitos y guiones
  if (!/^[\w-]+$/.test(beforeColon)) { return null; }

  return { colonIdx, value: afterColon, prop: beforeColon };
}

// Construye la expresión canónica para referencias de colores CSS custom properties
export function buildVarExpr(scssName: string, alias: string): string {
  return `var(--${scssName}, ${alias}.$${scssName})`;
}

// Comprueba si el texto anterior tiene un `var(` sin cerrar
// Usado para detectar si vars.$colorVar ya está dentro de var(...)
export function isInsideVarCall(textBefore: string): boolean {
  let depth = 0;
  for (let i = textBefore.length - 1; i >= 0; i--) {
    const ch = textBefore[i];
    if (ch === ')') {
      depth++;
    } else if (ch === '(') {
      if (depth === 0) {
        const preceding = textBefore.substring(Math.max(0, i - 3), i);
        return preceding === 'var';
      }
      depth--;
    }
  }
  return false;
}
