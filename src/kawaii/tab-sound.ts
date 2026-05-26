import * as vscode from 'vscode';
import { playExtensionWav } from './sound-player';

const TAB_SOUND = ['media', 'sounds', 'tab-open.wav'] as const;

export function isTabSoundEnabled(): boolean {
  return vscode.workspace.getConfiguration().get<boolean>('robertgozu.waifu.tabSound', false);
}

function tabKey(tab: vscode.Tab): string | undefined {
  const input = tab.input;
  if (input instanceof vscode.TabInputText) {
    return input.uri.toString();
  }
  if (input instanceof vscode.TabInputTextDiff) {
    return input.modified.toString();
  }
  return undefined;
}

function isPlayableTab(tab: vscode.Tab): boolean {
  const input = tab.input;
  if (input instanceof vscode.TabInputText) {
    return input.uri.scheme === 'file' || input.uri.scheme === 'untitled';
  }
  if (input instanceof vscode.TabInputTextDiff) {
    const u = input.modified;
    return u.scheme === 'file' || u.scheme === 'untitled';
  }
  return false;
}

function collectPlayableTabKeys(): Set<string> {
  const keys = new Set<string>();
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (!isPlayableTab(tab)) {
        continue;
      }
      const key = tabKey(tab);
      if (key) {
        keys.add(key);
      }
    }
  }
  return keys;
}

function playTabOpenSound(extensionUri: vscode.Uri): void {
  playExtensionWav(extensionUri, TAB_SOUND);
}

export function registerTabSound(context: vscode.ExtensionContext): void {
  const extensionUri = context.extensionUri;
  let knownTabKeys = collectPlayableTabKeys();

  const onTabsChanged = () => {
    if (!isTabSoundEnabled()) {
      knownTabKeys = collectPlayableTabKeys();
      return;
    }

    const current = collectPlayableTabKeys();
    for (const key of current) {
      if (!knownTabKeys.has(key)) {
        playTabOpenSound(extensionUri);
        break;
      }
    }
    knownTabKeys = current;
  };

  const onOpenDocument = (doc: vscode.TextDocument) => {
    if (!isTabSoundEnabled()) {
      return;
    }
    if (doc.uri.scheme !== 'file' && doc.uri.scheme !== 'untitled') {
      return;
    }
    const key = doc.uri.toString();
    if (knownTabKeys.has(key)) {
      return;
    }

    setTimeout(() => {
      if (!isTabSoundEnabled()) {
        return;
      }
      const inTab = collectPlayableTabKeys().has(key);
      if (!inTab) {
        return;
      }
      if (knownTabKeys.has(key)) {
        return;
      }
      knownTabKeys.add(key);
      playTabOpenSound(extensionUri);
    }, 50);
  };

  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(onTabsChanged),
    vscode.workspace.onDidOpenTextDocument(onOpenDocument),
  );
}
