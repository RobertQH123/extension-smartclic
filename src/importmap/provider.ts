import * as vscode from 'vscode';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as os from 'os';

export type MfeStatus = 'local' | 'dev' | 'unknown';
export type ProcState = 'compiling' | 'running' | 'error' | 'stopping';
export type LibState  = 'idle' | 'building' | 'published';
export type YalcStatus = 'yalc' | 'nexus' | 'none';
export type YalcPendingState = 'adding' | 'updating' | 'removing';

export interface MfeEntry {
  name: string;
  shortName: string;
  currentUrl: string;
  localUrl: string | null;
  devUrl: string | null;
  status: MfeStatus;
  isRunning: boolean | null; // null = not yet checked
}

export function isPortReachable(rawUrl: string): Promise<boolean> {
  return new Promise(resolve => {
    const fullUrl = rawUrl.startsWith('//') ? `http:${rawUrl}` : rawUrl;
    let settled = false;
    const done = (v: boolean) => { if (!settled) { settled = true; resolve(v); } };
    try {
      const parsed = new URL(fullUrl);
      const req = http.get(
        { hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, timeout: 800 },
        () => { done(true); req.destroy(); },
      );
      req.on('error', () => done(false));
      req.on('timeout', () => { req.destroy(); });
    } catch { done(false); }
  });
}

function detectIPv4(): string | null {
  const ifaces = os.networkInterfaces();
  const wifiRe    = /wi.?fi|wireless|wlan/i;
  const virtualRe = /vmware|virtualbox|hyper.?v|wsl|loopback|pseudo|isatap|teredo/i;

  let fallback: string | null = null;
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (virtualRe.test(name)) { continue; }
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) { continue; }
      if (wifiRe.test(name)) { return addr.address; } // WiFi tiene prioridad
      if (!fallback) { fallback = addr.address; }      // Ethernet u otra como fallback
    }
  }
  return fallback;
}

function readImports(filePath: string): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')).imports ?? {};
  } catch { return {}; }
}

// importmap-local.json usa claves distintas para algunos MFEs; las normalizamos al nombre canónico
const ALIAS_TO_CANONICAL: Record<string, string> = {
  '@sreasons/root-config':      '@sreasons/erp-mf-root-config',
  '@sreasons/erp-mf-comun':     '@sreasons/erp-mf-common',
  '@sreasons/erp-mf-seguridad': '@sreasons/erp-mf-security',
};

function normalizeImports(imports: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(imports)) {
    result[ALIAS_TO_CANONICAL[key] ?? key] = value;
  }
  return result;
}

export let lastImportmapSearchRoots: string[] = [];

function subdirs(base: string, exclude?: string): string[] {
  try {
    return fs.readdirSync(base, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== exclude)
      .map(e => path.join(base, e.name));
  } catch { return []; }
}

function findImportmapDirSync(): string | null {
  const folders = vscode.workspace.workspaceFolders ?? [];

  if (!folders.length) {
    lastImportmapSearchRoots = [];
    return null;
  }

  const checked = new Set<string>();
  const dirs: string[] = [];
  const diagnostic: string[] = [];

  for (const folder of folders) {
    const folderPath = folder.uri.fsPath;
    const parent    = path.dirname(folderPath);

    diagnostic.push(`Workspace: ${folderPath}`);
    diagnostic.push(`Padre: ${parent}`);

    // Workspace folder + sus hijos directos
    dirs.push(folderPath);
    dirs.push(...subdirs(folderPath));

    // Hermanas (hijos del padre) + sus hijos directos (excluye node_modules)
    const siblings = subdirs(parent);
    diagnostic.push(`Hermanas: ${siblings.map(d => path.basename(d)).join(', ') || '(ninguna)'}`);

    for (const sib of siblings) {
      dirs.push(sib);
      dirs.push(...subdirs(sib, 'node_modules'));
    }
  }

  lastImportmapSearchRoots = diagnostic;

  for (const dir of dirs) {
    if (checked.has(dir)) { continue; }
    checked.add(dir);
    if (fs.existsSync(path.join(dir, 'importmap-local.json'))) { return dir; }
  }
  return null;
}

async function findImportmapDir(): Promise<string | null> {
  // Búsqueda directa con fs (más rápida y fiable que findFiles en workspaces grandes)
  const syncResult = findImportmapDirSync();
  if (syncResult) { return syncResult; }

  // Último recurso: API de VS Code
  try {
    const found = await vscode.workspace.findFiles('**/importmap-local.json', '**/node_modules/**', 1);
    if (found.length) { return path.dirname(found[0].fsPath); }
  } catch { /* ignore */ }

  return null;
}

export class ImportMapProvider {
  private dir: string | null = null;
  useIPv4 = false;
  readonly detectedIPv4 = detectIPv4();

  get ready(): boolean { return this.dir !== null; }
  get activeFilePath(): string | null { return this.dir ? path.join(this.dir, 'importmap.json') : null; }

  // Carpeta que contiene todos los repositorios MFE (hermanos del repo del importmap)
  get mfeBaseDir(): string | null {
    if (!this.dir) { return null; }
    let d = this.dir;
    const intermediate = new Set(['src', 'source', 'app']);
    while (intermediate.has(path.basename(d))) {
      const parent = path.dirname(d);
      if (parent === d) { break; }
      d = parent;
    }
    return path.dirname(d);
  }

  async init(): Promise<void> {
    this.dir = await findImportmapDir();
  }

  localUrl(raw: string): string {
    if (this.useIPv4 && this.detectedIPv4) {
      return raw.replace(/localhost/g, this.detectedIPv4);
    }
    return raw;
  }

  getEntries(): MfeEntry[] {
    if (!this.dir) { return []; }

    const active = readImports(path.join(this.dir, 'importmap.json'));
    const local  = normalizeImports(readImports(path.join(this.dir, 'importmap-local.json')));
    const dev    = readImports(path.join(this.dir, 'importmap-dev.json'));

    const names = new Set([...Object.keys(active), ...Object.keys(local), ...Object.keys(dev)]
      .filter(n => n.startsWith('@sreasons/')));

    return [...names].sort().map(name => {
      const currentUrl = active[name] ?? '';
      const localUrl   = local[name] ?? null;
      const devUrl     = dev[name] ?? null;

      let status: MfeStatus = 'unknown';
      if (localUrl) {
        const effectiveLocal = this.localUrl(localUrl);
        if (currentUrl === effectiveLocal || currentUrl === localUrl) { status = 'local'; }
      }
      if (status !== 'local' && devUrl && currentUrl === devUrl) { status = 'dev'; }
      // URL apuntando a localhost aunque no coincida exactamente con importmap-local → es local
      if (status === 'unknown' && /^(\/\/|http:\/\/)(localhost|127\.0\.0\.1)/.test(currentUrl)) {
        status = 'local';
      }

      return {
        name,
        shortName: name.replace('@sreasons/', ''),
        currentUrl,
        localUrl,
        devUrl,
        status,
        isRunning: null,
      };
    });
  }

  setEntry(name: string, url: string): void {
    if (!this.dir) { return; }
    const filePath = path.join(this.dir, 'importmap.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    content.imports[name] = url;
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  }

  applyIpMode(): void {
    if (!this.dir) { return; }
    const filePath = path.join(this.dir, 'importmap.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const entry of this.getEntries()) {
      if (entry.status !== 'local' || !entry.localUrl) { continue; }
      content.imports[entry.name] = this.localUrl(entry.localUrl);
    }
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  }

  setAll(target: 'local' | 'dev'): void {
    if (!this.dir) { return; }
    const filePath = path.join(this.dir, 'importmap.json');
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const entry of this.getEntries()) {
      const url = target === 'local'
        ? (entry.localUrl ? this.localUrl(entry.localUrl) : null)
        : entry.devUrl;
      if (url) { content.imports[entry.name] = url; }
    }

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf8');
  }
}
