import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const iconsDir = path.join(root, 'media', 'folders');
const outFile = path.join(root, 'themes', 'smartclic-icon-theme.json');

/** Carpetas Smartclic → icono cerrado / abierto (id sin .svg) */
const SMARTCLIC_FOLDER_ICONS = {
  assets: { closed: 'folder_type_datadog', open: 'folder_type_datadog_opened' },
  guard: { closed: 'folder_type_certificate', open: 'folder_type_certificate_opened' },
  resources: { closed: 'folder_type_gcp', open: 'folder_type_gcp_opened' },
  constants: { closed: 'folder_type_grunt', open: 'folder_type_grunt_opened' },
  components: { closed: 'folder_type_gulp', open: 'folder_type_gulp_opened' },
  helper: { closed: 'folder_type_helper', open: 'folder_type_helper_opened' },
  '@types': { closed: 'folder_type_husky', open: 'folder_type_husky_opened' },
  composables: { closed: 'pollo', open: 'pollo_open' },
  core: { closed: 'perro', open: 'perro_open' },
  store: { closed: 'garra', open: 'garra_open' },
  views: { closed: 'folder', open: 'folder_open' },
  utils: { closed: 'burro', open: 'burro_open' },
  enums: { closed: 'conejo', open: 'conejo_open' },
};

/** Archivos Smartclic: extensión → icono vscode-icons */
const SMARTCLIC_FILE_EXTENSIONS = {
  json: 'file_type_json',
  vue: 'file_type_vue',
  scss: 'file_type_scss',
  ts: 'file_type_typescript_official',
};

/** Por languageId del editor (p. ej. .vue sin extensión en el mapa) */
const SMARTCLIC_LANGUAGE_IDS = {
  json: 'file_type_json',
  vue: 'file_type_vue',
  scss: 'file_type_scss',
  typescript: 'file_type_typescript_official',
};

function readText(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

function listSvgs() {
  return new Set(
    fs.readdirSync(iconsDir).filter((f) => f.endsWith('.svg')),
  );
}

function iconPath(filename) {
  return `../media/folders/${filename}`;
}

function fileIconName(icon, svgs, light) {
  const candidates = light
    ? [`file_type_light_${icon}.svg`, `file_type_${icon}.svg`]
    : [`file_type_${icon}.svg`, `file_type_light_${icon}.svg`];
  return candidates.find((c) => svgs.has(c)) ?? null;
}

function folderIconNames(icon, svgs, light) {
  const closed = light
    ? [`folder_type_light_${icon}.svg`, `folder_type_${icon}.svg`]
    : [`folder_type_${icon}.svg`, `folder_type_light_${icon}.svg`];
  const opened = light
    ? [`folder_type_light_${icon}_opened.svg`, `folder_type_${icon}_opened.svg`]
    : [`folder_type_${icon}_opened.svg`, `folder_type_light_${icon}_opened.svg`];
  const closedFile = closed.find((c) => svgs.has(c));
  const openFile = opened.find((c) => svgs.has(c));
  if (!closedFile || !openFile) {
    return null;
  }
  return { closed: closedFile.replace(/\.svg$/, ''), open: openFile.replace(/\.svg$/, '') };
}

function parseEntries(source) {
  const entries = [];
  const blocks = source.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) ?? [];
  for (const block of blocks) {
    const icon = block.match(/icon:\s*'([^']+)'/)?.[1];
    if (!icon) {
      continue;
    }
    if (/disabled:\s*true/.test(block)) {
      continue;
    }
    const light = /light:\s*true/.test(block);
    const extMatch = block.match(/extensions:\s*\[([\s\S]*?)\]/);
    const extensions = extMatch
      ? [...extMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : [];
    const langMatch = block.match(/languages:\s*\[([\s\S]*?)\]/);
    const languages = langMatch
      ? [...langMatch[1].matchAll(/languages\.(\w+)/g)].map((m) => m[1])
      : [];
    entries.push({ icon, extensions, languages, light });
  }
  return entries;
}

function parseLanguages(source) {
  const map = new Map();
  for (const block of source.match(/\w+:\s*\{[^{}]+\}/g) ?? []) {
    const id = block.match(/^(\w+):/)?.[1];
    const ids = block.match(/ids:\s*\[([\s\S]*?)\]/)?.[1];
    if (!id || !ids) {
      continue;
    }
    const languageIds = [...ids.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    map.set(id, languageIds);
  }
  return map;
}

function main() {
  const svgs = listSvgs();
  const iconDefinitions = {};

  for (const file of svgs) {
    const id = file.replace(/\.svg$/, '');
    iconDefinitions[id] = { iconPath: iconPath(file) };
  }

  const theme = {
    iconDefinitions,
    folder: 'default_folder',
    folderExpanded: 'default_folder_opened',
    rootFolder: 'default_root_folder',
    rootFolderExpanded: 'default_root_folder_opened',
    file: 'default_file',
    fileExtensions: {},
    fileNames: {},
    folderNames: {},
    folderNamesExpanded: {},
    languageIds: {},
  };

  const folderEntries = parseEntries(readText('supportedFolders.ts'));
  for (const { icon, extensions, light } of folderEntries) {
    const names = folderIconNames(icon, svgs, light);
    if (!names) {
      continue;
    }
    for (const ext of extensions) {
      const folderName = ext.startsWith('.') ? ext.slice(1) : ext;
      if (!folderName) {
        continue;
      }
      theme.folderNames[folderName] = names.closed;
      theme.folderNamesExpanded[folderName] = names.open;
    }
  }

  const fileEntries = parseEntries(readText('supportedExtensions.ts'));
  let languagesSource = '';
  try {
    languagesSource = readText('languages.ts');
  } catch {
  }
  const languageMap = languagesSource ? parseLanguages(languagesSource) : new Map();

  for (const { icon, extensions, languages, light } of fileEntries) {
    const iconId = fileIconName(icon, svgs, light);
    if (!iconId) {
      continue;
    }
    const defId = iconId.replace(/\.svg$/, '');

    for (const ext of extensions) {
      if (ext.includes('/') || ext.includes('*')) {
        continue;
      }
      if (ext.startsWith('.')) {
        theme.fileNames[ext.slice(1)] = defId;
        continue;
      }
      if (ext.includes('.')) {
        theme.fileNames[ext] = defId;
      } else {
        theme.fileExtensions[ext] = defId;
      }
    }

    for (const lang of languages) {
      const ids = languageMap.get(lang) ?? [];
      for (const languageId of ids) {
        theme.languageIds[languageId] = defId;
      }
    }
  }

  for (const [folderName, { closed, open }] of Object.entries(SMARTCLIC_FOLDER_ICONS)) {
    if (
      svgs.has(`${closed}.svg`) &&
      svgs.has(`${open}.svg`) &&
      theme.iconDefinitions[closed] &&
      theme.iconDefinitions[open]
    ) {
      theme.folderNames[folderName] = closed;
      theme.folderNamesExpanded[folderName] = open;
    }
  }

  for (const [ext, iconId] of Object.entries(SMARTCLIC_FILE_EXTENSIONS)) {
    const svg = `${iconId}.svg`;
    if (svgs.has(svg) && theme.iconDefinitions[iconId]) {
      theme.fileExtensions[ext] = iconId;
    }
  }

  for (const [languageId, iconId] of Object.entries(SMARTCLIC_LANGUAGE_IDS)) {
    const svg = `${iconId}.svg`;
    if (svgs.has(svg) && theme.iconDefinitions[iconId]) {
      theme.languageIds[languageId] = iconId;
    }
  }

  fs.writeFileSync(outFile, `${JSON.stringify(theme, null, 2)}\n`, 'utf8');

  console.log('Generated:', outFile);
  console.log('Icons:', Object.keys(iconDefinitions).length);
  console.log('File extensions:', Object.keys(theme.fileExtensions).length);
  console.log('File names:', Object.keys(theme.fileNames).length);
  console.log('Folder names:', Object.keys(theme.folderNames).length);
  console.log('Language ids:', Object.keys(theme.languageIds).length);
}

main();
