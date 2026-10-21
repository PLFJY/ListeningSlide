// Optional regeneration of vendored web font data using the official native tool.
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
const native = path.resolve('runtime/onlyoffice/darwin-arm64');
if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw new Error(
    'This regeneration command uses the verified macOS ARM64 frameworks. Normal preparation on Windows uses the vendored, architecture-independent web font data.',
  );
const result = spawnSync(
  '/usr/bin/clang++',
  [
    '-std=c++11',
    '-DKERNEL_USE_DYNAMIC_LIBRARY',
    '-DGRAPHICS_USE_DYNAMIC_LIBRARY',
    'third_party/ONLYOFFICE/DesktopEditors/core/DesktopEditor/AllFontsGen/main.cpp',
    '-F',
    path.join(native, 'converter'),
    '-framework',
    'graphics',
    '-framework',
    'kernel',
    '-framework',
    'UnicodeConverter',
    '-Wl,-rpath,@executable_path/converter',
    '-o',
    path.join(native, 'allfontsgen'),
  ],
  { stdio: 'inherit' },
);
if (result.status) process.exit(result.status);
await fs.rm('runtime/onlyoffice/font_selection.bin', { force: true });
const generate = spawnSync(
  path.join(native, 'allfontsgen'),
  [
    '--use-system=false',
    '--use-system-user-fonts=false',
    '--input=runtime/onlyoffice/font-input',
    '--allfonts=runtime/onlyoffice/fonts-local.js',
    '--allfonts-web=third_party/fonts/web/AllFonts.js',
    '--selection=runtime/onlyoffice/font_selection.bin',
    '--output-web=third_party/fonts/web',
  ],
  { stdio: 'inherit' },
);
if (generate.status) process.exit(generate.status);
console.log(
  'Regenerated web font data with unmodified official core AllFontsGen/main.cpp. Update third_party/fonts/checksums.json after reviewing the new font set.',
);
