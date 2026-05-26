import * as vscode from 'vscode';
import {
  formatKawaiiDiagnostic,
  formatPlainDiagnostic,
  pickPlainWelcomeMessage,
  pickWelcomeMessage,
} from './messages';
import { registerStartupSound } from './startup-sound';
import { registerTabSound } from './tab-sound';
import { isWaifuWriteEnabled, KawaiiTypingEffect } from './typing-effect';

export { formatKawaiiDiagnostic, formatPlainDiagnostic } from './messages';

let welcomeShownThisSession = false;

/** Mensajes kawaii (bienvenida, errores SCSS). Por defecto desactivado. */
export function isWaifuMessageEnabled(): boolean {
  return vscode.workspace.getConfiguration().get<boolean>('robertgozu.waifu.message', false);
}

/** @deprecated Usar isWaifuMessageEnabled */
export function isKawaiiErrorsEnabled(): boolean {
  return isWaifuMessageEnabled();
}

function pickWelcomeForSettings(): string {
  return isWaifuMessageEnabled() ? pickWelcomeMessage() : pickPlainWelcomeMessage();
}

export function formatDiagnosticMessage(
  diagnostic: vscode.Diagnostic,
  severity: vscode.DiagnosticSeverity,
): string {
  return isWaifuMessageEnabled()
    ? formatKawaiiDiagnostic(diagnostic, severity)
    : formatPlainDiagnostic(diagnostic);
}

export function registerKawaii(context: vscode.ExtensionContext): void {
  const showWelcome = () => {
    if (welcomeShownThisSession) {
      return;
    }
    welcomeShownThisSession = true;
    void vscode.window.showInformationMessage(pickWelcomeForSettings());
  };

  showWelcome();

  const typingEffect = new KawaiiTypingEffect(context.extensionUri);
  registerStartupSound(context);
  registerTabSound(context);

  context.subscriptions.push(
    typingEffect,
    vscode.commands.registerCommand('smartclic.kawaii.welcome', () => {
      void vscode.window.showInformationMessage(pickWelcomeForSettings());
    }),
    vscode.workspace.onDidChangeTextDocument(e => {
      if (!isWaifuWriteEnabled()) {
        return;
      }
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== e.document) {
        return;
      }
      let lastInsert: vscode.TextDocumentContentChangeEvent | undefined;
      for (let i = e.contentChanges.length - 1; i >= 0; i--) {
        if (e.contentChanges[i].text.length > 0) {
          lastInsert = e.contentChanges[i];
          break;
        }
      }
      if (!lastInsert) {
        return;
      }

      const offset = e.document.offsetAt(lastInsert.range.start) + lastInsert.text.length;
      const pos = e.document.positionAt(offset);
      typingEffect.onType(editor, pos);
    }),
  );
}
