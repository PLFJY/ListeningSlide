import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const electron = JSON.parse(await readFile('node_modules/electron/package.json', 'utf8'));
const cachedElectron = path.resolve(
  'build-cache',
  `electron-v${electron.version}-win32-x64.zip`,
);
const args = ['--win', 'portable', '--x64', '--config.directories.output=release/onlyoffice'];
if (existsSync(cachedElectron)) {
  args.push(`--config.electronDist=${cachedElectron}`);
  console.log(`Using cached Windows Electron ${electron.version}.`);
}

const cli = createRequire(import.meta.url).resolve('electron-builder/cli.js');
const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' });
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
