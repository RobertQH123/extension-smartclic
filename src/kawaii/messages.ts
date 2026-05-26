import * as vscode from 'vscode';

export const WELCOME_MESSAGES = [
  'Ohayou, senpai! 🌸✨',
  'Yatta~ ¡VS Code listo para codear! 🎀💫',
  'Konnichiwa, senpai~ 💖🌸 ¡Que tengas un día genial!',
  'Ganbatte ne, senpai! 🌸✨(ﾉ◕ヮ◕)ﾉ',
  'Senpai, tus MFEs te esperan~ 💮🌺',
  'UwU ✨ modo waifu activado~ 🌸',
  'Desu~ 💖 ¡a codear con estilo kawaii! 🎀',
  'Kyaa~ 🌸 ¡bienvenido de vuelta, senpai! ✧',
  'Nya nya~ 🐾 VS Code está listo 💫',
  '(｡♥‿♥｡) 🌸 Ohayou gozaimasu, senpai!',
] as const;

const ERROR_TEMPLATES = [
  'Nani?! 😱 {msg} en línea {line}',
  'Senpai, esto no cuadra (╥﹏╥) {msg} — línea {line}',
  'Baka~ no puede ser! (>_<) {msg} (línea {line})',
  'Mou~ ¡arregla esto! 💢 {msg} en línea {line}',
  'Sugoi... pero esto está mal 👉 {msg} (línea {line})',
] as const;

const WARNING_TEMPLATES = [
  'Ehh? 🤔 {msg} — línea {line}',
  'Senpai, ojo con esto~ ⚠️ {msg} (línea {line})',
  'Chotto matte... {msg} en línea {line}',
] as const;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickStable<T>(items: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % items.length;
  }
  return items[hash];
}

export function formatKawaiiDiagnostic(
  diagnostic: vscode.Diagnostic,
  severity: vscode.DiagnosticSeverity
): string {
  const line = diagnostic.range.start.line + 1;
  const msg = diagnostic.message;
  const seed = `${line}:${msg}`;
  const templates = severity === vscode.DiagnosticSeverity.Warning
    ? WARNING_TEMPLATES
    : ERROR_TEMPLATES;
  const template = pickStable(templates, seed);
  return template.replace('{msg}', msg).replace('{line}', String(line));
}

export function pickWelcomeMessage(): string {
  return pickRandom(WELCOME_MESSAGES);
}

export function formatPlainDiagnostic(diagnostic: vscode.Diagnostic): string {
  const line = diagnostic.range.start.line + 1;
  return `Línea ${line}: ${diagnostic.message}`;
}

export function pickPlainWelcomeMessage(): string {
  return 'Smartclic DevTools está listo.';
}
