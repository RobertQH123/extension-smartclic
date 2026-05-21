import * as vscode from 'vscode';
import { existsSync } from 'fs';

export function getPreviewUri(
  extensionUri: vscode.Uri,
  componentName: string,
  variantValue?: string
): vscode.Uri | null {
  const baseName = variantValue ? `${componentName}--${variantValue}` : componentName;
  for (const ext of ['.webp', '.png']) {
    const uri = vscode.Uri.joinPath(extensionUri, 'previews', baseName + ext);
    if (existsSync(uri.fsPath)) { return uri; }
  }
  return null;
}
