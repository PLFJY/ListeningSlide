import { verifyArchivedSource } from './source-checkout-manifest.mjs';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(
  await fs.readFile(path.join(root, 'engine/onlyoffice/upstream.lock.json'), 'utf8'),
);
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const platform = option('--platform') || `${process.platform}-${process.arch}`;
const upstream = path.join(root, 'third_party/ONLYOFFICE/DesktopEditors');
const runtime = path.join(root, 'public/onlyoffice/runtime');
const nativeRoot = path.join(root, 'runtime/onlyoffice', platform);
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
function run(command, params, cwd = root, env = process.env) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, params, { cwd, env, stdio: 'inherit', shell: false });
    process.on('error', reject);
    process.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
async function gitOutput(params, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', params, { cwd, shell: false });
    let output = '';
    child.stdout.on('data', (data) => (output += data));
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`git ${params.join(' ')} exited ${code}`)),
    );
  });
}
async function verifyRepository(directory, repository, commit) {
  const actual = await gitOutput(['rev-parse', 'HEAD'], directory);
  const remote = await gitOutput(['remote', 'get-url', 'origin'], directory);
  if (actual !== commit || remote !== repository)
    throw new Error(`Source pin mismatch at ${directory}: ${actual} / ${remote}`);
  const dirty = await gitOutput(['status', '--porcelain', '--untracked-files=no'], directory);
  if (dirty)
    throw new Error(
      `Tracked upstream sources changed at ${directory}; use a clean official checkout.`,
    );
}
if (!args.includes('--native-only')) {
  if (
    !(await exists(path.join(upstream, '.git'))) &&
    (await exists(path.join(upstream, '../source-checkouts.json')))
  ) {
    await verifyArchivedSource(upstream, lock);
  } else {
    if (!(await exists(path.join(upstream, '.git'))))
      await run('git', ['clone', '--depth', '1', '--branch', lock.tag, lock.repository, upstream]);
    // Verify the parent first, then initialize its exact gitlinks (never component master).
    const actual = await gitOutput(['rev-parse', 'HEAD'], upstream);
    if (actual !== lock.commit) throw new Error('DesktopEditors is not pinned v10.0.0');
    await run(
      'git',
      ['submodule', 'update', '--init', '--depth', '1', '--jobs', '4', 'core', 'sdkjs', 'web-apps'],
      upstream,
    );
    await verifyRepository(upstream, lock.repository, lock.commit);
    for (const [name, module] of Object.entries(lock.submodules))
      await verifyRepository(path.join(upstream, name), module.repository, module.commit);
  }
  await run(
    process.platform === 'win32' ? 'python' : 'python3',
    ['build.py', '--product', 'slide'],
    path.join(upstream, 'sdkjs/build'),
    { ...process.env, PRODUCT_VERSION: lock.version },
  );
  await fs.mkdir(runtime, { recursive: true });
  await fs.rm(path.join(runtime, 'sdkjs'), { recursive: true, force: true });
  await fs.cp(path.join(upstream, 'sdkjs/deploy/sdkjs'), path.join(runtime, 'sdkjs'), {
    recursive: true,
  });
  const player = path.join(runtime, 'web-apps/apps/presentationeditor/main');
  await fs.mkdir(player, { recursive: true });
  for (const file of ['player.html', 'player.css', 'bridge.js'])
    await fs.copyFile(path.join(root, 'engine/onlyoffice', file), path.join(player, file));
  const vendor = path.join(runtime, 'web-apps/vendor/xregexp');
  await fs.mkdir(vendor, { recursive: true });
  await fs.copyFile(
    path.join(upstream, 'web-apps/vendor/xregexp/xregexp-all-min.js'),
    path.join(vendor, 'xregexp-all-min.js'),
  );
  await fs.copyFile(
    path.join(upstream, 'sdkjs/LICENSE'),
    path.join(root, 'public/onlyoffice/LICENSE.txt'),
  );
  await fs.copyFile(
    path.join(root, 'third_party/fonts/web/AllFonts.js'),
    path.join(runtime, 'sdkjs/common/AllFonts.js'),
  );
  await fs.rm(path.join(runtime, 'fonts'), { recursive: true, force: true });
  await fs.mkdir(path.join(runtime, 'fonts'), { recursive: true });
  for (const font of await fs.readdir(path.join(root, 'third_party/fonts/web')))
    if (/^\d+$/.test(font))
      await fs.copyFile(
        path.join(root, 'third_party/fonts/web', font),
        path.join(runtime, 'fonts', font),
      );
  await fs.writeFile(path.join(runtime, 'source-manifest.json'), JSON.stringify(lock, null, 2));
  const fontDir = path.join(root, 'runtime/onlyoffice/font-input');
  await fs.rm(fontDir, { recursive: true, force: true });
  await fs.mkdir(fontDir, { recursive: true });
  for (const dir of ['liberation', 'noto-sc'])
    for (const font of await fs.readdir(path.join(root, 'third_party/fonts', dir)))
      if (/\.(ttf|otf)$/i.test(font))
        await fs.copyFile(
          path.join(root, 'third_party/fonts', dir, font),
          path.join(fontDir, font),
        );
  console.log('Built unmodified official SDKJS slide engine and prepared offline fonts.');
}
if (args.includes('--sdk-only')) process.exit(0);
const release = lock.releases[platform];
if (!release) throw new Error(`No verified release configured for ${platform}`);
const source = `https://github.com/ONLYOFFICE/DesktopEditors/releases/download/${lock.tag}/${release.asset}`;
const archive = path.resolve(
  option('--archive') || path.join(root, 'third_party/ONLYOFFICE/downloads', release.asset),
);
await fs.mkdir(path.dirname(archive), { recursive: true });
if (!(await exists(archive)))
  await run('curl', [
    '--fail',
    '--location',
    '--connect-timeout',
    '20',
    '--max-time',
    '900',
    source,
    '--output',
    archive,
  ]);
const hash = createHash('sha256');
for await (const bytes of createReadStream(archive)) hash.update(bytes);
if (hash.digest('hex') !== release.sha256)
  throw new Error(`Official archive SHA256 mismatch: ${archive}. No fallback source will be used.`);
await fs.mkdir(nativeRoot, { recursive: true });
if (platform.startsWith('win32-')) {
  const zip = await JSZip.loadAsync(await fs.readFile(archive));
  const converter = Object.keys(zip.files).find((name) => /(^|\/)converter\/x2t\.exe$/i.test(name));
  if (!converter) throw new Error('Official Windows archive has no converter/x2t.exe');
  const prefix = converter.slice(0, -'x2t.exe'.length);
  const packageRoot = prefix.slice(0, -'converter/'.length);
  let count = 0;
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    if (name.startsWith(packageRoot + 'license/')) {
      const notice = name.slice((packageRoot + 'license/').length);
      if (!notice.split(/[\\/]/).includes('..')) {
        const target = path.join(nativeRoot, 'licenses', notice);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, await file.async('nodebuffer'));
      }
    }
    if (!name.startsWith(prefix)) continue;
    const relative = name.slice(prefix.length);
    if (relative.split(/[\\/]/).includes('..') || path.isAbsolute(relative))
      throw new Error('Unsafe official archive path');
    const target = path.join(nativeRoot, 'converter', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await file.async('nodebuffer'));
    count++;
  }
  console.log(`Extracted ${count} official converter files for ${platform}.`);
} else {
  if (process.platform !== 'darwin') throw new Error('DMG extraction requires macOS');
  const mount = await fs.mkdtemp(path.join(process.env.TMPDIR || '/tmp', 'listeningslide-dmg-'));
  let mounted = false;
  try {
    await run('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, archive]);
    mounted = true;
    await fs.cp(
      path.join(mount, 'ONLYOFFICE.app/Contents/Resources/converter'),
      path.join(nativeRoot, 'converter'),
      { recursive: true },
    );
    await fs.cp(
      path.join(mount, 'ONLYOFFICE.app/Contents/Resources/license'),
      path.join(nativeRoot, 'licenses'),
      { recursive: true },
    );
  } finally {
    if (mounted) await run('hdiutil', ['detach', mount]);
    await fs.rm(mount, { recursive: true, force: true });
  }
}
await fs.writeFile(
  path.join(nativeRoot, 'provenance.json'),
  JSON.stringify(
    {
      version: lock.version,
      source,
      sha256: release.sha256,
      sdkjsCommit: lock.submodules.sdkjs.commit,
      extracted: 'converter directory, unmodified',
    },
    null,
    2,
  ),
);
console.log(
  `Prepared verified official ONLYOFFICE ${lock.version} native runtime for ${platform}.`,
);
