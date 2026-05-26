import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as vscode from 'vscode';

let lastPlayAt = 0;
const MIN_INTERVAL_MS = 300;

function playWavFile(filePath: string): void {
  if (process.platform === 'win32') {
    const escaped = filePath.replace(/'/g, "''");
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-Command',
        `$p=New-Object System.Media.SoundPlayer '${escaped}'; $p.PlaySync()`,
      ],
      { windowsHide: true, stdio: 'ignore' },
    );
    child.on('error', () => undefined);
    child.unref();
    return;
  }
  if (process.platform === 'darwin') {
    spawn('afplay', [filePath], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  spawn('aplay', ['-q', filePath], { detached: true, stdio: 'ignore' }).unref();
}

export function playExtensionWav(
  extensionUri: vscode.Uri,
  parts: readonly string[],
  throttle = true,
): void {
  if (throttle) {
    const now = Date.now();
    if (now - lastPlayAt < MIN_INTERVAL_MS) {
      return;
    }
    lastPlayAt = now;
  }

  const wavPath = vscode.Uri.joinPath(extensionUri, ...parts).fsPath;
  if (!fs.existsSync(wavPath)) {
    return;
  }
  try {
    playWavFile(wavPath);
  } catch {
    // sin sonido si el SO no puede reproducir
  }
}
