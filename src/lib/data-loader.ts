import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';

export type AttrValue = { name: string; description?: string };
export type Attribute = { name: string; description?: string; default?: string; values?: AttrValue[]; valueSet?: string };
export type ComponentData = { name: string; description?: string; attributes: Attribute[] };

const LIBRARY_PKG = '@erp-mf/erp2-components-vue';
const DATA_FILE = 'smartclic-data.json';

export function findDataFile(extensionUri: vscode.Uri): string | null {
  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    for (const folder of folders) {
      const candidate = path.join(folder.uri.fsPath, 'node_modules', LIBRARY_PKG, DATA_FILE);
      if (existsSync(candidate)) { return candidate; }
    }
  }
  const bundled = path.join(extensionUri.fsPath, DATA_FILE);
  if (existsSync(bundled)) { return bundled; }
  return null;
}

export function loadComponents(extensionUri: vscode.Uri): Record<string, ComponentData> {
  const dataPath = findDataFile(extensionUri);
  if (!dataPath) { return {}; }
  try {
    const raw = JSON.parse(readFileSync(dataPath, 'utf8'));
    const map: Record<string, ComponentData> = {};
    for (const tag of raw.tags ?? []) {
      map[tag.name] = {
        name: tag.name,
        description: tag.description ?? '',
        attributes: tag.attributes ?? [],
      };
    }
    return map;
  } catch {
    return {};
  }
}
