import * as vscode from 'vscode';
import { playExtensionWav } from './sound-player';

const STARTUP_SOUND = ['media', 'sounds', 'startup.wav'] as const;

export function isStartupSoundEnabled(): boolean {
  return vscode.workspace.getConfiguration().get<boolean>('robertgozu.waifu.startupSound', false);
}

export function registerStartupSound(context: vscode.ExtensionContext): void {
  if (!isStartupSoundEnabled()) {
    return;
  }
  playExtensionWav(context.extensionUri, STARTUP_SOUND, false);
}
