import { writeSourceManifest } from './source-checkout-manifest.mjs';
import path from 'node:path';
// Keep this archive beside every distributed executable (AGPL corresponding source).
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('release', { recursive: true });
const lock = JSON.parse(await readFile('engine/onlyoffice/upstream.lock.json', 'utf8'));
await writeSourceManifest(path.resolve('third_party/ONLYOFFICE/DesktopEditors'), lock);
const output = `release/ListeningSlide-${version}-source.tar.gz`;
const args = [
  '-czf',
  output,
  '--exclude=.git',
  '--exclude=.DS_Store',
  '--exclude=public/onlyoffice/runtime',
  '--exclude=third_party/ONLYOFFICE/DesktopEditors/sdkjs/deploy',
  '--exclude=third_party/ONLYOFFICE/DesktopEditors/sdkjs/develop',
  'AGENTS.md',
  '.gitignore',
  '.prettierrc.json',
  'README.md',
  'LICENSE',
  'SOURCE.md',
  'THIRD_PARTY_NOTICES.md',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'index.html',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'src',
  'electron',
  'scripts',
  'tests',
  'engine',
  'docs',
  '.github',
  'build',
  'public',
  'third_party/fonts',
  'third_party/ONLYOFFICE/DesktopEditors',
  'third_party/ONLYOFFICE/source-checkouts.json',
];
await new Promise((resolve, reject) => {
  const child = spawn('tar', args, {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  child.on('error', reject);
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`tar exited ${code}`))));
});
console.log(`Corresponding source archive: ${output}`);
