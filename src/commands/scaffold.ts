import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vscode', 'coverage', 'out']);

function findStylesDir(fromDir: string): string | null {
  let dir = fromDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'assets', 'styles');
    if (fs.existsSync(candidate)) { return candidate; }
    const parent = path.dirname(dir);
    if (parent === dir) { break; }
    dir = parent;
  }
  return null;
}

function generateVue(name: string): string {
  return `<template>
  <div :class="PREFIX">
  </div>
</template>

<script src="./${name}.ts" lang="ts" />
<style src="./${name}.scss" lang="scss" scoped />
`;
}

function generateTs(name: string): string {
  return `import { defineComponent } from 'vue';

export default defineComponent({
  setup() {
    const PREFIX = '${name}';

    return {
      PREFIX,
    };
  },
});
`;
}

function generateScss(name: string, targetDir: string): string {
  const stylesDir = findStylesDir(path.dirname(targetDir));
  const relPath = stylesDir
    ? path.relative(targetDir, stylesDir).split(path.sep).join('/')
    : null;

  const imports: string[] = [];
  if (relPath && stylesDir && fs.existsSync(path.join(stylesDir, 'mixin.scss'))) {
    imports.push(`@use "${relPath}/mixin" as resol;`);
  }
  if (relPath && stylesDir && fs.existsSync(path.join(stylesDir, 'variables.scss'))) {
    imports.push(`@use "${relPath}/variables" as vars;`);
  }

  const header = imports.length ? imports.join('\n') + '\n\n' : '';

  return `${header}$prefix: ${name};

.#{$prefix} {
}
`;
}

function scanDirs(root: string, depth = 0): vscode.QuickPickItem[] {
  if (depth > 4) { return []; }
  const items: vscode.QuickPickItem[] = [];
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) { continue; }
      const full = path.join(root, entry.name);
      const label = path.relative(vscode.workspace.workspaceFolders![0].uri.fsPath, full).split(path.sep).join('/');
      items.push({ label, description: full });
      items.push(...scanDirs(full, depth + 1));
    }
  } catch { /* ignorar permisos */ }
  return items;
}

async function pickTargetDir(): Promise<string | undefined> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) { return undefined; }

  const dirs = scanDirs(workspaceRoot);
  if (!dirs.length) { return workspaceRoot; }

  const picked = await vscode.window.showQuickPick(dirs, {
    title: 'Seleccionar carpeta destino',
    placeHolder: 'Buscar carpeta...',
    matchOnDescription: false,
  });

  return picked?.description;
}

export async function scaffoldComponent(folderUri?: unknown): Promise<void> {
  const input = await vscode.window.showInputBox({
    title: 'Nuevo componente Smartclic',
    prompt: 'Nombre del componente en kebab-case',
    placeHolder: 'cmp-mi-componente',
    validateInput: (v) =>
      /^[a-z][a-z0-9-]*$/.test(v.trim()) ? null : 'Usa kebab-case: solo minúsculas, números y guiones',
  });

  if (!input) { return; }

  const name = input.trim();

  // Detectar carpeta: right-click URI → active editor → QuickPick
  let baseDir: string | undefined;

  if (folderUri && typeof folderUri === 'object' && 'fsPath' in (folderUri as object)) {
    baseDir = (folderUri as { fsPath: string }).fsPath;
  }

  if (!baseDir) {
    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeFile) { baseDir = path.dirname(activeFile); }
  }

  if (!baseDir) {
    baseDir = await pickTargetDir();
  }

  if (!baseDir) { return; }

  const targetDir = path.join(baseDir, name);

  if (fs.existsSync(targetDir)) {
    vscode.window.showErrorMessage(`La carpeta "${name}" ya existe en esa ubicación.`);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, `${name}.vue`), generateVue(name), 'utf8');
  fs.writeFileSync(path.join(targetDir, `${name}.ts`), generateTs(name), 'utf8');
  fs.writeFileSync(path.join(targetDir, `${name}.scss`), generateScss(name, targetDir), 'utf8');

  const vueUri = vscode.Uri.file(path.join(targetDir, `${name}.vue`));
  await vscode.window.showTextDocument(vueUri);

  vscode.window.showInformationMessage(`Componente "${name}" creado en ${path.basename(baseDir)}/`);
}
