import * as vscode from 'vscode';
import * as fs from 'fs';

export interface ClassEntry {
  name: string;
  css: string;
}

const CLASES_GLOB = '**/erp-mf-estilos/src/assets/styles/_clases.scss';

export async function loadClases(): Promise<ClassEntry[]> {
  const found = await vscode.workspace.findFiles(CLASES_GLOB, '**/node_modules/**', 1);
  if (!found.length) { return []; }
  try {
    const content = fs.readFileSync(found[0].fsPath, 'utf8');
    const entries: ClassEntry[] = [];
    const re = /\.([a-zA-Z][\w-]*)\s*\{([^}]+)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const props = m[2].trim().split(';').map(p => p.trim()).filter(Boolean);
      entries.push({ name: m[1], css: props.join(';\n') + ';' });
    }
    return entries;
  } catch { return []; }
}
