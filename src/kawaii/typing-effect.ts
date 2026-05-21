import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const ANIME_EMOJIS = ['🌸', '✨', '💮', '🌺', '⭐', '💖', '🎀', '💫', '☆', '♡', '✧', '(๑>◡<๑)', '>ω<'] as const;
const WAIFU_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.ico']);
const EFFECTS_DIR = 'effects';
const IDLE_HIDE_MS = 400;
/** Pequeño para no agrandar la línea; margen negativo simula posición más “flotante”. */
const WAIFU_PX = 14;
const AFTER_MARGIN = `-3px 0 0 2px`;

function loadWaifuUris(extensionUri: vscode.Uri): vscode.Uri[] {
  const effectsPath = path.join(extensionUri.fsPath, EFFECTS_DIR);
  const uris: vscode.Uri[] = [];

  if (fs.existsSync(effectsPath)) {
    const names = fs.readdirSync(effectsPath)
      .filter(name => WAIFU_EXTS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const name of names) {
      uris.push(vscode.Uri.joinPath(extensionUri, EFFECTS_DIR, name));
    }
  }

  if (uris.length > 0) { return uris; }

  return [
    vscode.Uri.joinPath(extensionUri, 'icon.webp'),
    vscode.Uri.joinPath(extensionUri, 'icon2.webp'),
  ];
}

/** Ancla al final del texto escrito; `after` queda justo detrás: rob|[icon] */
function anchorAfterText(line: number, char: number): vscode.Range {
  if (char <= 0) {
    return new vscode.Range(line, 0, line, 0);
  }
  return new vscode.Range(line, 0, line, char);
}

type ParticleKind = 'emoji' | 'waifu';

interface ActiveParticle {
  editor: vscode.TextEditor;
  line: number;
  character: number;
  kind: ParticleKind;
  emoji: string;
  waifuUri: vscode.Uri;
  hideTimer: ReturnType<typeof setTimeout>;
}

export class KawaiiTypingEffect implements vscode.Disposable {
  private readonly waifuUris: vscode.Uri[];
  private readonly emojiDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none; display: inline',
  });
  private readonly waifuDecoration = vscode.window.createTextEditorDecorationType({
    textDecoration: 'none; display: inline',
  });
  private readonly activeByDoc = new Map<string, ActiveParticle>();

  constructor(private readonly extensionUri: vscode.Uri) {
    this.waifuUris = loadWaifuUris(extensionUri);
  }

  dispose(): void {
    for (const active of this.activeByDoc.values()) {
      clearTimeout(active.hideTimer);
    }
    this.activeByDoc.clear();
    this.emojiDecoration.dispose();
    this.waifuDecoration.dispose();
    this.clearAllDecorations();
  }

  onType(editor: vscode.TextEditor, position: vscode.Position): void {
    if (!this.isEnabled()) { return; }

    const docKey = editor.document.uri.toString();
    const prev = this.activeByDoc.get(docKey);
    if (prev) { clearTimeout(prev.hideTimer); }

    const kind: ParticleKind = Math.random() < 0.5 ? 'emoji' : 'waifu';
    const hideTimer = setTimeout(() => {
      this.activeByDoc.delete(docKey);
      this.render();
    }, IDLE_HIDE_MS);

    this.activeByDoc.set(docKey, {
      editor,
      line: position.line,
      character: position.character,
      kind,
      emoji: ANIME_EMOJIS[Math.floor(Math.random() * ANIME_EMOJIS.length)],
      waifuUri: this.waifuUris[Math.floor(Math.random() * this.waifuUris.length)],
      hideTimer,
    });

    this.render();
  }

  private isEnabled(): boolean {
    return vscode.workspace.getConfiguration('smartclic.kawaii').get<boolean>('typingEffect', true);
  }

  private render(): void {
    const emojiByEditor = new Map<vscode.TextEditor, vscode.DecorationOptions[]>();
    const waifuByEditor = new Map<vscode.TextEditor, vscode.DecorationOptions[]>();
    const visible = new Set(vscode.window.visibleTextEditors);

    for (const active of this.activeByDoc.values()) {
      if (!visible.has(active.editor)) { continue; }

      const doc = active.editor.document;
      const line = Math.min(active.line, doc.lineCount - 1);
      const lineText = doc.lineAt(line).text;
      const char = Math.min(active.character, lineText.length);
      const range = anchorAfterText(line, char);

      if (active.kind === 'emoji') {
        let list = emojiByEditor.get(active.editor);
        if (!list) {
          list = [];
          emojiByEditor.set(active.editor, list);
        }
        list.push({
          range,
          renderOptions: {
            after: {
              contentText: active.emoji,
              margin: AFTER_MARGIN,
              textDecoration: 'none; font-size: 14px; line-height: 14px',
            },
          },
        });
      } else {
        let list = waifuByEditor.get(active.editor);
        if (!list) {
          list = [];
          waifuByEditor.set(active.editor, list);
        }
        list.push({
          range,
          renderOptions: {
            after: {
              contentIconPath: active.waifuUri,
              margin: AFTER_MARGIN,
              width: `${WAIFU_PX}px`,
              height: `${WAIFU_PX}px`,
            },
          },
        });
      }
    }

    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.emojiDecoration, emojiByEditor.get(editor) ?? []);
      editor.setDecorations(this.waifuDecoration, waifuByEditor.get(editor) ?? []);
    }
  }

  private clearAllDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.emojiDecoration, []);
      editor.setDecorations(this.waifuDecoration, []);
    }
  }
}
