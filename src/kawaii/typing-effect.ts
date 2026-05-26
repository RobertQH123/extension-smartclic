import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const WAIFU_EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.ico']);
const EFFECTS_DIR = 'effects';
const IDLE_HIDE_MS = 400;
const WAIFU_PX = 14;
const FLOAT_MARGIN_TOP_PX = 18;

const FLOAT_ICON_AFTER = {
  width: `${WAIFU_PX}px`,
  height: '0',
  margin: `-${FLOAT_MARGIN_TOP_PX}px 0 0 2px`,
  textDecoration: 'none; overflow: visible',
} as const;

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

function anchorAfterText(line: number, char: number): vscode.Range {
  if (char <= 0) {
    return new vscode.Range(line, 0, line, 0);
  }
  return new vscode.Range(line, 0, line, char);
}

interface ActiveWaifu {
  editor: vscode.TextEditor;
  line: number;
  character: number;
  waifuUri: vscode.Uri;
  hideTimer: ReturnType<typeof setTimeout>;
}

export function isWaifuWriteEnabled(): boolean {
  return vscode.workspace.getConfiguration().get<boolean>('robertgozu.waifu.write', false);
}

export class KawaiiTypingEffect implements vscode.Disposable {
  private readonly waifuUris: vscode.Uri[];
  private readonly waifuDecoration = vscode.window.createTextEditorDecorationType({});
  private readonly activeByDoc = new Map<string, ActiveWaifu>();

  constructor(private readonly extensionUri: vscode.Uri) {
    this.waifuUris = loadWaifuUris(extensionUri);
  }

  dispose(): void {
    for (const active of this.activeByDoc.values()) {
      clearTimeout(active.hideTimer);
    }
    this.activeByDoc.clear();
    this.waifuDecoration.dispose();
    this.clearWaifuDecorations();
  }

  onType(editor: vscode.TextEditor, position: vscode.Position): void {
    if (!isWaifuWriteEnabled()) { return; }

    const docKey = editor.document.uri.toString();
    const prev = this.activeByDoc.get(docKey);
    if (prev) { clearTimeout(prev.hideTimer); }

    const hideTimer = setTimeout(() => {
      this.activeByDoc.delete(docKey);
      this.render();
    }, IDLE_HIDE_MS);

    this.activeByDoc.set(docKey, {
      editor,
      line: position.line,
      character: position.character,
      waifuUri: this.waifuUris[Math.floor(Math.random() * this.waifuUris.length)],
      hideTimer,
    });

    this.render();
  }

  private render(): void {
    const waifuByEditor = new Map<vscode.TextEditor, vscode.DecorationOptions[]>();
    const visible = new Set(vscode.window.visibleTextEditors);

    for (const active of this.activeByDoc.values()) {
      if (!visible.has(active.editor)) { continue; }

      const doc = active.editor.document;
      const line = Math.min(active.line, doc.lineCount - 1);
      const lineText = doc.lineAt(line).text;
      const char = Math.min(active.character, lineText.length);
      const range = anchorAfterText(line, char);

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
            ...FLOAT_ICON_AFTER,
          },
        },
      });
    }

    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.waifuDecoration, waifuByEditor.get(editor) ?? []);
    }
  }

  private clearWaifuDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.waifuDecoration, []);
    }
  }
}
