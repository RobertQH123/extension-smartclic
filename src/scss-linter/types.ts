import * as vscode from 'vscode';

export interface TextFix {
  range: vscode.Range;
  newText: string;
}

export interface LintResult {
  diagnostic: vscode.Diagnostic;
  fix?: TextFix;
}
