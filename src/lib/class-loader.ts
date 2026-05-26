import * as vscode from 'vscode';
import * as fs from 'fs';

export interface ClassEntry {
  name: string;
  css: string;
}

const CLASES_GLOB = '**/erp-mf-estilos/src/assets/styles/_clases.scss';

// Extrae el bloque completo de una regla CSS/SCSS con llaves balanceadas.
// Devuelve las propiedades de nivel raíz (no las de bloques anidados).
function extractRootProps(content: string, openBrace: number): string {
  let depth = 0;
  let start = -1;
  const props: string[] = [];
  let propAccum = '';

  for (let i = openBrace; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') {
      depth++;
      if (depth === 1) { start = i + 1; propAccum = ''; }
    } else if (ch === '}') {
      depth--;
      if (depth === 0) { break; }
    } else if (depth === 1) {
      if (ch === ';') {
        const prop = propAccum.trim();
        if (prop && !prop.startsWith('//') && !prop.startsWith('/*')) { props.push(prop); }
        propAccum = '';
      } else if (ch === '\n' || ch === '\r') {
        // saltos de línea dentro de una propiedad → tratarlos como espacio
        propAccum += ' ';
      } else {
        propAccum += ch;
      }
    }
  }

  if (start === -1) { return ''; }
  return props.join(';\n') + (props.length ? ';' : '');
}

export async function loadClases(): Promise<ClassEntry[]> {
  const found = await vscode.workspace.findFiles(CLASES_GLOB, '**/node_modules/**', 1);
  if (!found.length) { return []; }
  try {
    const content = fs.readFileSync(found[0].fsPath, 'utf8');
    const entries: ClassEntry[] = [];
    // Busca selectores de clase de nivel raíz (no anidados): empieza en col 0 o tras nueva línea
    const selectorRe = /(?:^|\n)\.([a-zA-Z][\w-]*)\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = selectorRe.exec(content)) !== null) {
      const name = m[1];
      const openBrace = m.index + m[0].lastIndexOf('{');
      const css = extractRootProps(content, openBrace);
      if (css) { entries.push({ name, css }); }
    }
    return entries;
  } catch { return []; }
}
