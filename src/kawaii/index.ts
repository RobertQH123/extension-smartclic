import * as vscode from 'vscode';
import { pickWelcomeMessage } from './messages';
import { KawaiiTypingEffect } from './typing-effect';

export { formatKawaiiDiagnostic } from './messages';

let welcomeShownThisSession = false;

export function isKawaiiErrorsEnabled(): boolean {
  return vscode.workspace.getConfiguration('smartclic.kawaii').get<boolean>('errorMessages', true);
}

export function registerKawaii(context: vscode.ExtensionContext): void {
  const showWelcome = () => {
    if (welcomeShownThisSession) { return; }
    const enabled = vscode.workspace
      .getConfiguration('smartclic.kawaii')
      .get<boolean>('welcome', true);
    if (!enabled) { return; }

    welcomeShownThisSession = true;
    void vscode.window.showInformationMessage(pickWelcomeMessage());
  };

  showWelcome();

  const typingEffect = new KawaiiTypingEffect(context.extensionUri);

  context.subscriptions.push(
    typingEffect,
    vscode.commands.registerCommand('smartclic.kawaii.welcome', () => {
      void vscode.window.showInformationMessage(pickWelcomeMessage());
    }),
    vscode.workspace.onDidChangeTextDocument(e => {
      if (!vscode.workspace.getConfiguration('smartclic.kawaii').get<boolean>('typingEffect', true)) {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== e.document) { return; }
      let lastInsert: vscode.TextDocumentContentChangeEvent | undefined;
      for (let i = e.contentChanges.length - 1; i >= 0; i--) {
        if (e.contentChanges[i].text.length > 0) {
          lastInsert = e.contentChanges[i];
          break;
        }
      }
      if (!lastInsert) { return; }

      const offset = e.document.offsetAt(lastInsert.range.start) + lastInsert.text.length;
      const pos = e.document.positionAt(offset);
      typingEffect.onType(editor, pos);
    })
  );
}
