import * as vscode from 'vscode';
import { loadComponents } from './lib/data-loader';
import { loadClases } from './lib/class-loader';
import type { ClassEntry } from './lib/class-loader';
import { createCompletionProvider } from './providers/completion';
import { createHoverProvider } from './providers/hover';
import { registerScssLinter } from './scss-linter/index';
import { scaffoldComponent } from './commands/scaffold';
import { registerImportMapView } from './importmap/register';
import { registerKawaii } from './kawaii';

const DATA_FILE_GLOB = '**/node_modules/@erp-mf/erp2-components-vue/smartclic-data.json';
const CLASES_GLOB = '**/erp-mf-estilos/src/assets/styles/_clases.scss';

export function activate(context: vscode.ExtensionContext): void {
  const extensionUri = context.extensionUri;
  let components = loadComponents(extensionUri);
  let classes: ClassEntry[] = [];

  const getComponents = () => components;
  const getClasses = () => classes;

  loadClases().then(result => { classes = result; });

  // Recarga los componentes si smartclic-data.json cambia en node_modules
  const watcher = vscode.workspace.createFileSystemWatcher(DATA_FILE_GLOB);
  watcher.onDidChange(() => { components = loadComponents(extensionUri); });
  watcher.onDidCreate(() => { components = loadComponents(extensionUri); });

  // Recarga las clases si _clases.scss cambia
  const clasesWatcher = vscode.workspace.createFileSystemWatcher(CLASES_GLOB);
  clasesWatcher.onDidChange(() => { loadClases().then(r => { classes = r; }); });
  clasesWatcher.onDidCreate(() => { loadClases().then(r => { classes = r; }); });

  context.subscriptions.push(
    watcher,
    clasesWatcher,
    createCompletionProvider(extensionUri, getComponents, getClasses),
    createHoverProvider(extensionUri, getComponents),
    vscode.commands.registerCommand('smartclic.scaffoldComponent', scaffoldComponent),
  );

  registerKawaii(context);
  registerScssLinter(context);
  registerImportMapView(context);
}

export function deactivate(): void {}
