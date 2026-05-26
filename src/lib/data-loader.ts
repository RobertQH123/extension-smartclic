import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';

export type AttrValue = { name: string; description?: string };
export type Attribute = { name: string; description?: string; default?: string; values?: AttrValue[]; valueSet?: string };
export type SlotDef = { name: string; description?: string };
export type ComponentData = { name: string; description?: string; attributes: Attribute[]; slots: SlotDef[] };

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

    // Construye un mapa de valueSets para resolución de atributos con "valueSet": "v"
    const valueSets: Record<string, AttrValue[]> = {};
    for (const vs of raw.valueSets ?? []) {
      valueSets[vs.name] = (vs.values ?? []).map((v: { name: string; description?: string }) => ({
        name: v.name,
        description: v.description,
      }));
    }

    const map: Record<string, ComponentData> = {};
    for (const tag of raw.tags ?? []) {
      const attributes: Attribute[] = (tag.attributes ?? []).map((attr: Attribute) => {
        if (!attr.values && attr.valueSet && valueSets[attr.valueSet]) {
          return { ...attr, values: valueSets[attr.valueSet] };
        }
        return attr;
      });
      const slots: SlotDef[] = (tag.slots ?? []).map((s: SlotDef) => ({
        name: s.name,
        description: s.description,
      }));
      map[tag.name] = { name: tag.name, description: tag.description ?? '', attributes, slots };
    }
    return map;
  } catch {
    return {};
  }
}
