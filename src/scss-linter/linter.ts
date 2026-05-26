import * as vscode from 'vscode';
import type { LintResult } from './types';
import { loadVariableMap } from './variable-parser';
import { detectImportAliases } from './utils';
import { importAliasRule } from './rules/import-alias.rule';
import { aliasRule } from './rules/alias.rule';
import { rawValueRule } from './rules/raw-value.rule';
import { colorRule } from './rules/color.rule';

export function lintDocument(document: vscode.TextDocument): LintResult[] {
  const results: LintResult[] = [];

  const lines = document.getText().split('\n');
  const aliases = detectImportAliases(lines);
  const varMap = loadVariableMap(document.uri.fsPath) ?? undefined;

  results.push(...importAliasRule(document, aliases));          // F7: warnings de @use
  results.push(...aliasRule(document, aliases, varMap));        // F3: alias de variables y breakpoints

  if (varMap) {
    results.push(...rawValueRule(document, varMap, aliases));   // F1/F2
    results.push(...colorRule(document, varMap, aliases));      // F4/F5/F6/F6b
  }

  return results;
}
