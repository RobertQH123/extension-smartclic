import * as vscode from 'vscode';
import type { TextFix } from './types';
import { lintDocument } from './linter';
import { ScssCodeActionProvider, buildAutoFixEdits } from './autofix';
import { registerBreakpointCompletions } from './breakpoint-completions';
import { formatDiagnosticMessage } from '../kawaii';
import { registerColorCompletions } from './color-completions';
import { registerVariableCompletions } from './variable-completions';
import { ScssColorProvider } from './color-provider';

const SCSS_LANG = { language: 'scss' };
const DEBOUNCE_MS = 400;

// Archivos fuente directos en assets/styles/ (variables, mixins, helpers…) — no se lintean
const SOURCE_STYLES_RE = /[/\\]assets[/\\]styles[/\\][^/\\]+\.scss$/;
function isSourceStyleFile(doc: vscode.TextDocument): boolean {
  return SOURCE_STYLES_RE.test(doc.uri.fsPath);
}

export function registerScssLinter(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('scss-smartclic');

  // Mapa compartido entre el runner y el CodeActionProvider para recuperar el fix de cada diagnóstico
  const fixMap = new WeakMap<vscode.Diagnostic, TextFix>();

  function runLint(document: vscode.TextDocument): void {
    if (document.languageId !== 'scss') { return; }
    if (isSourceStyleFile(document)) { collection.delete(document.uri); return; }

    const results = lintDocument(document);
    const diagnostics = results.map(r => {
      const d = new vscode.Diagnostic(
        r.diagnostic.range,
        formatDiagnosticMessage(r.diagnostic, r.diagnostic.severity),
        r.diagnostic.severity,
      );
      d.source = r.diagnostic.source;
      d.code = r.diagnostic.code;
      if (r.fix) { fixMap.set(d, r.fix); }
      return d;
    });
    collection.set(document.uri, diagnostics);
  }

  // Lint de documentos ya abiertos al activar la extensión
  vscode.workspace.textDocuments.forEach(runLint);

  // Lint con debounce al editar
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const onChangeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
    if (e.document.languageId !== 'scss') { return; }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runLint(e.document), DEBOUNCE_MS);
  });

  const onOpenDisposable = vscode.workspace.onDidOpenTextDocument(runLint);

  const onCloseDisposable = vscode.workspace.onDidCloseTextDocument(doc => {
    collection.delete(doc.uri);
  });

  // Autofix al guardar con Ctrl+S (solo si smartclic.scss.autoFixOnSave está activado en settings)
  const onSaveDisposable = vscode.workspace.onWillSaveTextDocument(event => {
    if (event.document.languageId !== 'scss') { return; }
    if (isSourceStyleFile(event.document)) { return; }
    const enabled = vscode.workspace.getConfiguration('smartclic.scss').get<boolean>('autoFixOnSave', false);
    if (!enabled) { return; }
    const results = lintDocument(event.document);
    const edits = buildAutoFixEdits(results);
    if (edits.length > 0) {
      event.waitUntil(Promise.resolve(edits));
    }
  });

  // Comando manual: aplica autofix y guarda (atajo por defecto Ctrl+Alt+S)
  const fixAndSaveDisposable = vscode.commands.registerCommand('smartclic.scss.fixAndSave', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'scss') { return; }
    const doc = editor.document;
    if (isSourceStyleFile(doc)) { await doc.save(); return; }
    const results = lintDocument(doc);
    const textEdits = buildAutoFixEdits(results);
    if (textEdits.length > 0) {
      const we = new vscode.WorkspaceEdit();
      we.set(doc.uri, textEdits);
      await vscode.workspace.applyEdit(we);
    }
    await doc.save();
  });

  // Bombilla (lightbulb) para aplicar fixes manualmente
  const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
    SCSS_LANG,
    new ScssCodeActionProvider(fixMap),
    { providedCodeActionKinds: ScssCodeActionProvider.providedCodeActionKinds }
  );

  registerBreakpointCompletions(context);
  registerColorCompletions(context);
  registerVariableCompletions(context);

  const colorProviderDisposable = vscode.languages.registerColorProvider(
    SCSS_LANG,
    new ScssColorProvider()
  );

  context.subscriptions.push(
    collection,
    onChangeDisposable,
    onOpenDisposable,
    onCloseDisposable,
    onSaveDisposable,
    fixAndSaveDisposable,
    codeActionDisposable,
    colorProviderDisposable
  );
}
